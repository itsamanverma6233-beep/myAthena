const { BrowserWindow, app, ipcMain } = require("electron");
const path = require("path");

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  if (isDev) {
    win.loadURL("http://localhost:5173/");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("full-screen", () => {
  if (win) win.kiosk = true;
});

app.whenReady().then(() => {
  createWindow();
});
