const { BrowserWindow, app, ipcMain, screen } = require("electron");
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

ipcMain.handle("check-displays", () => {
  const displays = screen.getAllDisplays();
  return {
    count: displays.length,
    isSingleDisplay: displays.length === 1,
    displays: displays.map((d, index) => ({
      id: d.id,
      index: index + 1,
      bounds: d.bounds,
      isPrimary: d.id === screen.getPrimaryDisplay().id,
    })),
  };
});

app.whenReady().then(() => {
  createWindow();
});
