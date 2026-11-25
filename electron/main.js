// App de computador (Windows e Linux). Serve a pasta www em http://localhost para que
// o banco local, o Firebase e a biometria (WebAuthn / Windows Hello) funcionem como no navegador.
const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'www');
// Identidade própria: porta, armazenamento e pasta de dados exclusivos deste app,
// para não se misturar com outros apps instalados no mesmo computador.
const APP_ID = 'br.com.partner.pprpca';
const PARTITION = 'persist:partner-ppr-pca';
const BASE_PORT = 40000 + ([...APP_ID].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 9000);
const PORTS = [BASE_PORT, BASE_PORT + 1, BASE_PORT + 2]; // porta fixa: mantém os dados locais entre aberturas
app.setName('Partner PPR e PCA');
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.ico': 'image/x-icon' };

function handler(req, res) {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (p === '/__app') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(APP_ID); }
    if (p === '/') p = '/index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Não encontrado'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
}
// Escuta só no próprio computador (IPv4 e IPv6), nunca na rede
function serve() {
  return new Promise((resolve, reject) => {
    const tryPort = i => {
      if (i >= PORTS.length) return reject(new Error('Nenhuma porta livre'));
      const v4 = http.createServer(handler);
      v4.once('error', () => tryPort(i + 1));
      v4.listen(PORTS[i], '127.0.0.1', () => {
        const v6 = http.createServer(handler);
        v6.on('error', () => {}); // sem IPv6: segue só com IPv4
        v6.listen(PORTS[i], '::1');
        resolve(PORTS[i]);
      });
    };
    tryPort(0);
  });
}

async function createWindow() {
  const port = await serve();
  const win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 380, minHeight: 600,
    title: 'Partner: gerenciamento em PPR e PCA',
    icon: path.join(ROOT, 'icons', 'icon-512.png'),
    backgroundColor: '#EDF1EF',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: PARTITION }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${port}`)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.loadURL(`http://localhost:${port}/index.html`);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
