const { BrowserWindow, app, ipcMain, dialog, screen } = require("electron");
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
  // Disable right-click context menu
  win.webContents.on("context-menu", (e) => {
    e.preventDefault();
  });

  // Block shortcut keys (DevTools, Reload, Print)
  win.webContents.on("before-input-event", (event, input) => {
    const isControlOrCmd = input.control || input.meta;

    // Block DevTools: F12 or Ctrl+Shift+I / Cmd+Alt+I
    if (input.key === "F12" || (isControlOrCmd && (input.shift || input.alt) && input.key.toLowerCase() === "i")) {
      event.preventDefault();
      return;
    }

    // Block Reload: F5 or Ctrl+R / Cmd+R
    if (input.key === "F5" || (isControlOrCmd && input.key.toLowerCase() === "r")) {
      event.preventDefault();
      return;
    }

    // Block Print: Ctrl+P / Cmd+P
    if (isControlOrCmd && input.key.toLowerCase() === "p") {
      event.preventDefault();
      return;
    }
  });

  win.on("blur", () => {
    if (end_time && end_time > Date.now()) {
      win.webContents.send("window-blur-detected");
    }
  });
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

ipcMain.handle("show-rules", async () => {
  const res = await dialog.showMessageBox(win, {
    type: "info",
    title: "Athena Exam Protocol & Rules",
    message: "Please review and accept the examination rules:",
    detail: [
      "1. Camera & Microphone: Must remain enabled and unobstructed at all times.",
      "2. Environment Lockdown: Fullscreen kiosk mode is strictly enforced.",
      "3. Anti-Cheating: Window switching or loss of focus triggers violation strikes.",
      "4. Integrity: Copy, paste, context menu, and external shortcuts are disabled.",
      "5. Timer: Exam auto-submits when remaining time reaches 00:00:00."
    ].join("\n\n"),
    buttons: ["Accept & Begin Exam", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  });

  return res.response === 0;
});

function appendAuditLog(entry) {
  try {
    const feedDir = path.join(__dirname, "cameraFeed");
    if (!fs.existsSync(feedDir)) {
      fs.mkdirSync(feedDir, { recursive: true });
    }
    const logPath = path.join(feedDir, "audit_log.json");
    let logs = [];
    if (fs.existsSync(logPath)) {
      try {
        logs = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      } catch {
        logs = [];
      }
    }
    const logRecord = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    logs.push(logRecord);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    return logRecord;
  } catch (err) {
    console.error("Failed to append audit log:", err);
    return null;
  }
}

ipcMain.handle("log-audit-event", (_, eventData) => {
  return appendAuditLog(eventData);
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
  appendAuditLog({ type: "PHOTO_SNAPSHOT_CAPTURED", fileName });
  return filePath;
});

app.whenReady().then(() => {
  createWindow();
});
