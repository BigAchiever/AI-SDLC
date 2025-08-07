// server.js (ES Module version for Vite + React SPA)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// ✅ Serve static assets from the "dist" folder
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ✅ SPA fallback: all unmatched routes return index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ✅ Start the server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
