const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setFullScreen: () => ipcRenderer.invoke("full-screen"),
  checkDisplays: () => ipcRenderer.invoke("check-displays"),
  getRemainingTime: () => ipcRenderer.invoke("get-time"),
  startTest: (durationMinutes) => ipcRenderer.invoke("start-test", durationMinutes),
  isTestActive: () => ipcRenderer.invoke("is-test-active"),
  showExamRules: () => ipcRenderer.invoke("show-rules"),
  savePhoto: (arrayBuffer) => ipcRenderer.invoke("save-photo", arrayBuffer),
  logAuditEvent: (data) => ipcRenderer.invoke("log-audit-event", data),
  onWindowBlur: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("window-blur-detected", handler);
    return () => ipcRenderer.removeListener("window-blur-detected", handler);
  },
});
