const { BrowserWindow, app, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");

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

let end_time = null;
let test_duration_minutes = 30;

ipcMain.handle("start-test", (_, durationMinutes) => {
  if (typeof durationMinutes === "number" && durationMinutes > 0) {
    test_duration_minutes = durationMinutes;
  }
  end_time = Date.now() + test_duration_minutes * 60 * 1000;
  return { startTime: Date.now(), endTime: end_time, durationMinutes: test_duration_minutes };
});

ipcMain.handle("get-time", () => {
  if (!end_time) return 0;
  const remaining = end_time - Date.now();
  return remaining > 0 ? remaining : 0;
});

ipcMain.handle("is-test-active", () => {
  return Boolean(end_time && end_time > Date.now());
});

ipcMain.handle("save-photo", (_, arrayBuffer) => {
  const feedDir = path.join(__dirname, "cameraFeed");
  if (!fs.existsSync(feedDir)) {
    fs.mkdirSync(feedDir, { recursive: true });
  }
  const fileName = `${Date.now()}.jpeg`;
  const filePath = path.join(feedDir, fileName);
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filePath, buffer);
  return filePath;
});

app.whenReady().then(() => {
  createWindow();
});
