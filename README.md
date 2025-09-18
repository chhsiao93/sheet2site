# Sheet2Site

Generate static websites from Google Drive and Google Sheets using Hugo and Tailwind CSS.

## How It Works

1. **Content Management**: Content creators manage content through Google Sheets (shared with view access)
2. **Assets**: Images and files are stored in Google Drive (shared with view access)
3. **Automation**: GitHub Actions automatically fetches content and builds the site
4. **Deployment**: Site is automatically deployed to GitHub Pages

## Setup Instructions

### 1. Fork this repository
Click the "Fork" button to create your own copy of this repository.

### 2. Create your Google Sheet
1. Create a new Google Sheet with the following columns:
   - `title` - The page/post title
   - `content` - The main content (supports Markdown)
   - `date` - Publication date (optional, defaults to current date)
   - `description` - Meta description for SEO (optional)
   - `tags` - Comma-separated tags (optional)
   - `image` - Google Drive link to featured image (optional)
   - `draft` - Set to "true" to keep as draft (optional)

2. Share the sheet with "Anyone with the link" (View access)

### 3. Configure GitHub repository
1. Go to your repository's Settings > Secrets and variables > Actions
2. Add the following secrets:
   - `GOOGLE_SHEET_URL`: Your Google Sheet URL
   - `SITE_TITLE`: Your website title (optional)
   - `SITE_DESCRIPTION`: Your website description (optional)

### 4. Enable GitHub Pages
1. Go to Settings > Pages
2. Select "GitHub Actions" as the source
3. Your site will be available at `https://yourusername.github.io/sheet2site`

### 5. Update configuration
Edit `hugo.toml` to customize:
- `baseURL`: Your GitHub Pages URL
- `title`: Your site title
- Other Hugo configuration options

## Content Management

### Adding Content
1. Open your Google Sheet
2. Add a new row with your content
3. The site will automatically rebuild within an hour, or you can trigger a manual build

### Images
1. Upload images to Google Drive
2. Share with "Anyone with the link" (View access)
3. Copy the sharing link and paste it in the `image` column
4. Images will be automatically downloaded and optimized

### Example Sheet Structure
| title | content | date | description | tags | image |
|-------|---------|------|-------------|------|-------|
| Hello World | This is my first post! | 2024-01-01 | My first blog post | blog,intro | https://drive.google.com/file/d/... |

## Local Development

1. Clone your repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Hugo:
   ```bash
   # macOS
   brew install hugo

   # Windows
   choco install hugo-extended

   # Linux
   sudo snap install hugo
   ```

4. Create `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env with your Google Sheet URL
   ```

5. Fetch content and start development server:
   ```bash
   npm run fetch-content
   npm run dev
   ```

## Customization

### Theme
- Edit files in `themes/sheet2site-theme/layouts/` to customize HTML structure
- Modify `assets/css/input.css` and `tailwind.config.js` for styling

### Build Process
- The build process is defined in `scripts/fetch-content.js`
- GitHub Actions workflow is in `.github/workflows/build-and-deploy.yml`

## Features

- ✅ Codeless content management via Google Sheets
- ✅ Image hosting via Google Drive
- ✅ Automatic builds with GitHub Actions
- ✅ Hugo static site generation
- ✅ Tailwind CSS styling
- ✅ SEO-friendly
- ✅ Mobile responsive
- ✅ Fast loading

## License

MIT License - see LICENSE file for details.