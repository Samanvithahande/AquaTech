import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const FASTAPI_URL = (process.env.FASTAPI_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function queryString(req: express.Request) {
  const index = req.originalUrl.indexOf('?');
  return index >= 0 ? req.originalUrl.slice(index) : '';
}

async function proxyRequest(
  req: express.Request,
  res: express.Response,
  targetPath: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  try {
    const target = `${FASTAPI_URL}${targetPath}${queryString(req)}`;
    const response = await fetch(target, {
      method: req.method,
      headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseBody = await response.text();
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    return res.send(responseBody);
  } catch (error) {
    console.error('FastAPI proxy error:', error);
    return res.status(502).json({
      detail: `Cannot reach FastAPI at ${FASTAPI_URL}. Start the backend and try again.`,
    });
  }
}

// These routes proxy to the real FastAPI application. No mock predictions are generated here.
app.get(['/api', '/api/health'], (req, res) => proxyRequest(req, res, '/api/health'));
app.post(['/water/predict', '/api/water/predict'], (req, res) =>
  proxyRequest(req, res, '/water/predict', req.body)
);
app.post(['/disease/predict', '/api/disease/predict'], upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ detail: 'Please upload an image file in the file field.' });
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), req.file.originalname || 'specimen.jpg');
    form.append('farm_id', String(req.body.farm_id || 'farm_001'));
    if (req.body.species) form.append('species', String(req.body.species));
    const target = `${FASTAPI_URL}/disease/predict${queryString(req)}`;
    const response = await fetch(target, { method: 'POST', body: form });
    const body = await response.text();
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    return res.send(body);
  } catch (error) {
    console.error('Disease proxy error:', error);
    return res.status(502).json({ detail: `Cannot reach FastAPI at ${FASTAPI_URL}.` });
  }
});
app.get(['/alerts', '/api/alerts'], (req, res) => proxyRequest(req, res, '/alerts'));
app.get(['/readings', '/api/readings'], (req, res) => proxyRequest(req, res, '/readings'));
app.get(['/assessments', '/api/assessments'], (req, res) => proxyRequest(req, res, '/assessments'));
app.post(['/replay', '/api/replay'], (req, res) => proxyRequest(req, res, '/replay', req.body));

async function start() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Aquaculture Alerts frontend server: http://localhost:${PORT}`);
    console.log(`FastAPI backend target: ${FASTAPI_URL}`);
  });
}

start().catch((error) => {
  console.error('Failed to start frontend server:', error);
  process.exit(1);
});
