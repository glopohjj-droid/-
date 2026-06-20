import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'news-store.json');
const ADMIN_KEY = 'admin123';

// Increase limits to handle Base64 embedded images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database helper functions
function readNewsFromFile(): any[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content) || [];
    }
  } catch (err) {
    console.error('Error reading news database file:', err);
  }
  return [];
}

function writeNewsToFile(newsList: any[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(newsList, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing news database file:', err);
  }
}

// Authentication middleware for mutation API endpoints
function authRequired(req: express.Request, res: express.Response, next: express.NextFunction) {
  const incomingKey = req.headers['x-admin-key'];
  if (incomingKey === ADMIN_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Неверный или отсутствующий ключ доступа.' });
  }
}

// API Routes
// 1. Get raw news list
app.get('/api/news', (req, res) => {
  const list = readNewsFromFile();
  res.json(list);
});

// 2. Publish new article (auth required)
app.post('/api/news', authRequired, (req, res) => {
  const { title, text, imageData } = req.body;
  if (!title || !title.trim() || !text || !text.trim()) {
    return res.status(400).json({ error: 'Заглавие и текст статьи обязательны.' });
  }

  const newsList = readNewsFromFile();
  const now = new Date();
  
  // Format date in Russian (e.g. "20 июня 2026 г.")
  const dateStr = now.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const newArticle = {
    id: now.getTime().toString() + '-' + Math.random().toString(36).substr(2, 9),
    title: title.trim(),
    text: text.trim(),
    imageData: imageData || null,
    date: dateStr,
    timestamp: now.getTime(),
  };

  newsList.push(newArticle);
  writeNewsToFile(newsList);

  res.status(201).json(newArticle);
});

// 3. Delete single news article (auth required)
app.delete('/api/news/:id', authRequired, (req, res) => {
  const { id } = req.params;
  let newsList = readNewsFromFile();
  const originalLength = newsList.length;
  
  newsList = newsList.filter((item) => item.id !== id);
  
  if (newsList.length === originalLength) {
    return res.status(404).json({ error: 'Новость не найдена' });
  }
  
  writeNewsToFile(newsList);
  res.json({ success: true });
});

// 4. Delete all news articles (auth required)
app.delete('/api/news', authRequired, (req, res) => {
  writeNewsToFile([]);
  res.json({ success: true });
});

// Vite middleware setup or Prod static files serving
async function initializeServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

initializeServer().catch((err) => {
  console.error('Failed to start server:', err);
});
