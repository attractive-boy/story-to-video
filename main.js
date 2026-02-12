const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const serve = require('electron-serve').default || require('electron-serve');

const loadURL = serve({ directory: 'out' });

// 保护机制：检查是否过期
function checkExpiration() {
  const expirationDate = new Date('2026-02-20');
  const currentDate = new Date();

  if (currentDate > expirationDate) {
    dialog.showErrorBox(
      '系统维护提示',
      '由于版本过旧，该程序已停止服务。请联系开发人员获取最新版本。'
    );
    app.quit();
    return true;
  }
  return false;
}

function createWindow() {
  if (checkExpiration()) return;

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (app.isPackaged) {
    loadURL(mainWindow);
  } else {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
