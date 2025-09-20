const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const YAML = require('yaml');

// Load .env file for local development, but environment variables take precedence
require('dotenv').config();

function extractFileIdFromUrl(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function downloadGoogleSheet(sheetUrl, outputPath) {
  const fileId = extractFileIdFromUrl(sheetUrl);
  if (!fileId) {
    throw new Error('Invalid Google Sheets URL');
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;

  try {
    const response = await axios.get(csvUrl);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, response.data);
    console.log(`Downloaded sheet to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to download Google Sheet: ${error.message}`);
  }
}

async function parseCSV(filePath) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function downloadFileFromDrive(fileUrl, filename) {
  const fileId = extractFileIdFromUrl(fileUrl);
  if (!fileId) {
    console.warn(`Invalid Google Drive file URL: ${fileUrl}`);
    return null;
  }

  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const outputPath = path.join('./static/images', filename);

  try {
    const response = await axios.get(downloadUrl, { responseType: 'stream' });
    await fs.ensureDir(path.dirname(outputPath));

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Downloaded image: ${filename}`);
        resolve(`/images/${filename}`);
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Failed to download ${filename}: ${error.message}`);
    return null;
  }
}

function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
}

async function generateHugoContent(data) {
  const contentDir = './content';
  await fs.ensureDir(contentDir);

  for (const row of data) {
    if (!row.title || !row.content) {
      console.warn('Skipping row with missing title or content');
      continue;
    }

    const slug = createSlug(row.title);
    const filename = `${slug}.md`;
    const filePath = path.join(contentDir, filename);

    // Handle image downloads if image URL is provided
    let imagePath = null;
    if (row.image && row.image.includes('drive.google.com')) {
      const imageExtension = '.jpg'; // Default extension
      const imageName = `${slug}${imageExtension}`;
      imagePath = await downloadFileFromDrive(row.image, imageName);
    }

    // Create frontmatter
    const frontmatter = {
      title: row.title,
      date: row.date || new Date().toISOString(),
      draft: row.draft === 'true' || false,
      description: row.description || '',
      tags: row.tags ? row.tags.split(',').map(tag => tag.trim()) : []
    };

    if (imagePath) {
      frontmatter.image = imagePath;
    }

    // Add any additional fields from the spreadsheet
    Object.keys(row).forEach(key => {
      if (!['title', 'content', 'date', 'draft', 'description', 'tags', 'image'].includes(key)) {
        frontmatter[key] = row[key];
      }
    });

    const content = `---\n${YAML.stringify(frontmatter)}---\n\n${row.content}`;

    await fs.writeFile(filePath, content);
    console.log(`Generated content: ${filename}`);
  }
}

async function processServices(data) {
  const services = [];
  for (const row of data) {
    if (!row.title || !row.description) continue;

    let imagePath = null;
    if (row.img && row.img.includes('drive.google.com')) {
      const slug = createSlug(row.title);
      const imageName = `service-${slug}.jpg`;
      imagePath = await downloadFileFromDrive(row.img, imageName);
    }

    services.push({
      title: row.title,
      description: row.description,
      icon: row.icon || '⚡',
      image: imagePath
    });
  }
  return services;
}

async function processProjects(data) {
  const projects = [];
  for (const row of data) {
    if (!row.title || !row.description) continue;

    let imagePath = null;
    if (row.img && row.img.includes('drive.google.com')) {
      const slug = createSlug(row.title);
      const imageName = `project-${slug}.jpg`;
      imagePath = await downloadFileFromDrive(row.img, imageName);
    }

    projects.push({
      title: row.title,
      description: row.description,
      image: imagePath,
      url: row.url || '#'
    });
  }
  return projects;
}

async function processContact(data) {
  const contact = {};
  for (const row of data) {
    if (row.field && row.value) {
      contact[row.field] = row.value;
    }
  }
  return contact;
}

async function updateHugoConfig(services, projects, contact) {
  const configPath = './hugo.toml';

  // Read existing config
  let config = '';
  if (await fs.pathExists(configPath)) {
    config = await fs.readFile(configPath, 'utf8');
  }

  // Generate new params section
  const paramsConfig = `
[params]
  description = '${process.env.SITE_DESCRIPTION || 'Website generated from Google Drive and Sheets'}'
  hero_image = '/images/hero.jpg'

  # Services section
${services.map((service, index) => `
  [[params.services]]
    title = '${service.title}'
    description = '${service.description}'
    icon = '${service.icon}'
    ${service.image ? `image = '${service.image}'` : ''}
`).join('')}

  # Projects section
${projects.map((project, index) => `
  [[params.projects]]
    title = '${project.title}'
    description = '${project.description}'
    ${project.image ? `image = '${project.image}'` : ''}
    url = '${project.url}'
`).join('')}

  # Contact information
  [params.contact]
    email = '${contact.email || 'hello@example.com'}'
    phone = '${contact.phone || ''}'
    address = '${contact.address || ''}'
`;

  // Update or append params section
  const baseConfigMatch = config.match(/^(.*?)(\[params\].*?)?(\[markup\].*)?$/s);
  let newConfig;

  if (baseConfigMatch) {
    const baseConfig = baseConfigMatch[1];
    const markupConfig = baseConfigMatch[3] || `
[markup]
  [markup.goldmark]
    [markup.goldmark.renderer]
      unsafe = true
`;
    newConfig = baseConfig + paramsConfig + markupConfig;
  } else {
    // If config doesn't exist, create basic structure
    newConfig = `baseURL = "${process.env.BASE_URL || 'https://example.org/'}"
languageCode = 'en-us'
title = '${process.env.SITE_TITLE || 'Sheet2Site'}'
theme = 'sheet2site-theme'
${paramsConfig}
[markup]
  [markup.goldmark]
    [markup.goldmark.renderer]
      unsafe = true
`;
  }

  await fs.writeFile(configPath, newConfig);
  console.log('Updated hugo.toml with new configuration');
}

async function main() {
  try {
    const urls = {
      posts: process.env.POST_URL,
      services: process.env.SERVICE_URL,
      projects: process.env.PROJECT_URL,
      contact: process.env.CONTACT_URL
    };

    // Debug: Log environment detection
    console.log('Environment detection:');
    console.log('- Running in:', process.env.NODE_ENV || 'development');
    console.log('- GitHub Actions:', process.env.GITHUB_ACTIONS ? 'Yes' : 'No');
    console.log('- Available URLs:');
    Object.entries(urls).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value ? '✓ Set' : '✗ Missing'}`);
    });

    // Check if required URLs are present
    if (!urls.services || !urls.projects || !urls.contact) {
      console.error('Missing required environment variables:');
      if (!urls.services) console.error('- SERVICE_URL is missing');
      if (!urls.projects) console.error('- PROJECT_URL is missing');
      if (!urls.contact) console.error('- CONTACT_URL is missing');
      throw new Error('SERVICE_URL, PROJECT_URL, and CONTACT_URL environment variables are required');
    }

    console.log('Fetching content from Google Sheets...');

    // Process Posts (if URL exists)
    if (urls.posts) {
      console.log('Processing posts...');
      const postsPath = './temp/posts.csv';
      await downloadGoogleSheet(urls.posts, postsPath);
      const postsData = await parseCSV(postsPath);
      await generateHugoContent(postsData);
      console.log(`Generated ${postsData.length} posts`);
    }

    // Process Services
    console.log('Processing services...');
    const servicesPath = './temp/services.csv';
    await downloadGoogleSheet(urls.services, servicesPath);
    const servicesData = await parseCSV(servicesPath);
    const services = await processServices(servicesData);
    console.log(`Processed ${services.length} services`);

    // Process Projects
    console.log('Processing projects...');
    const projectsPath = './temp/projects.csv';
    await downloadGoogleSheet(urls.projects, projectsPath);
    const projectsData = await parseCSV(projectsPath);
    const projects = await processProjects(projectsData);
    console.log(`Processed ${projects.length} projects`);

    // Process Contact
    console.log('Processing contact info...');
    const contactPath = './temp/contact.csv';
    await downloadGoogleSheet(urls.contact, contactPath);
    const contactData = await parseCSV(contactPath);
    const contact = await processContact(contactData);
    console.log('Processed contact information');

    // Update Hugo configuration
    await updateHugoConfig(services, projects, contact);

    // Clean up temp files
    await fs.remove('./temp');

    console.log('Content generation complete!');
    console.log('Run "hugo server" to view your updated site');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  downloadGoogleSheet,
  parseCSV,
  downloadFileFromDrive,
  generateHugoContent
};