const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const YAML = require('yaml');
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

async function main() {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (!sheetUrl) {
      throw new Error('GOOGLE_SHEET_URL environment variable is required');
    }

    console.log('Fetching content from Google Sheets...');

    // Download the sheet
    const csvPath = './temp/content.csv';
    await downloadGoogleSheet(sheetUrl, csvPath);

    // Parse the CSV
    const data = await parseCSV(csvPath);
    console.log(`Found ${data.length} rows of content`);

    // Generate Hugo content
    await generateHugoContent(data);

    // Clean up temp file
    await fs.remove('./temp');

    console.log('Content generation complete!');
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