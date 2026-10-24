import { spawn } from "node:child_process";

const DEV_SERVER_URL = "http://localhost:5173";

console.log("[myAthena] Starting Vite dev server...");
const viteProcess = spawn("npx", ["vite"], {
  stdio: "inherit",
  shell: true,
});

async function waitForServer(url, timeoutMs = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200 || res.status === 304) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

try {
  await waitForServer(DEV_SERVER_URL);
  console.log(`[myAthena] Vite is up at ${DEV_SERVER_URL}. Launching Electron...`);

  const electronProcess = spawn("npx", ["electron", "."], {
    stdio: "inherit",
    shell: true,
  });

  electronProcess.on("exit", (code) => {
    console.log(`[myAthena] Electron closed (code ${code}). Shutting down Vite...`);
    viteProcess.kill();
    process.exit(code || 0);
  });
} catch (err) {
  console.error("[myAthena] Error starting dev runner:", err);
  viteProcess.kill();
  process.exit(1);
}
