import { useEffect, useRef, useState } from "react";
import "./App.css";
import MainExam from "./components/MainExam";

function App() {
  const videoRef = useRef(null);
  const imageCaptureRef = useRef(null);

  const [time, setTime] = useState(0);
  const [started, setStarted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [fullscreenReady, setFullscreenReady] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const audioStreamRef = useRef(null);
  const [displayInfo, setDisplayInfo] = useState({ count: 1, isSingleDisplay: true });

  async function getMicrophone() {
    try {
      const audioData = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioData;
      setAudioReady(true);
      setSetupError(null);
    } catch (err) {
      console.error("Microphone access error:", err);
      setAudioReady(false);
      setSetupError("Microphone permission was denied. Please grant microphone access.");
    }
  }

  async function refreshDisplays() {
    if (window.electronAPI?.checkDisplays) {
      const info = await window.electronAPI.checkDisplays();
      setDisplayInfo(info);
    }
  }

  useEffect(() => {
    refreshDisplays();
  }, []);

  async function getLaspedTime() {
    if (window.electronAPI?.getRemainingTime) {
      const currTime = await window.electronAPI.getRemainingTime();
      setTime(currTime);
    }
  }

  useEffect(() => {
    if (!started) return;

    const interval = setInterval(() => {
      getLaspedTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [started]);

  async function getCamera() {
    try {
      const videoData = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = videoData;
      }

      const tracks = videoData.getVideoTracks();
      if (!tracks || tracks.length === 0 || tracks[0].readyState !== "live") {
        setCameraReady(false);
        setSetupError("Camera track is not live. Please verify camera device.");
        return;
      }

      const track = tracks[0];
      try {
        imageCaptureRef.current = new ImageCapture(track);
      } catch {
        imageCaptureRef.current = null;
      }

      setCameraReady(true);
      setSetupError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraReady(false);
      setSetupError("Camera access failed or permission denied. Please allow camera permissions.");
    }
  }

  async function clickPhoto() {
    if (!cameraReady || !imageCaptureRef.current) return;
    try {
      const blob = await imageCaptureRef.current.takePhoto();
      const buffer = await blob.arrayBuffer();
      if (window.electronAPI?.savePhoto) {
        await window.electronAPI.savePhoto(buffer);
      }
    } catch (err) {
      console.warn("Snapshot capture skipped:", err);
    }
  }

  useEffect(() => {
    if (!started || !cameraReady) return;
    const id = setInterval(() => {
      clickPhoto();
    }, 5000);

    return () => {
      clearInterval(id);
    };
  }, [started, cameraReady]);

  async function getFullscreen() {
    if (window.electronAPI?.setFullScreen) {
      await window.electronAPI.setFullScreen();
      setFullscreenReady(true);
    }
  }

  async function startTest() {
    // 1. Strict camera verification
    const hasActiveCamera =
      cameraReady &&
      videoRef.current &&
      videoRef.current.srcObject &&
      videoRef.current.srcObject.getVideoTracks()?.length > 0 &&
      videoRef.current.srcObject.getVideoTracks()[0].readyState === "live";

    if (!hasActiveCamera) {
      setSetupError("Camera verification required: Please click 'Enable Camera' and allow camera access before attempting the test.");
      return;
    }

    // 2. Microphone verification
    if (!audioReady) {
      setSetupError("Microphone verification required: Please click 'Enable Microphone' before proceeding.");
      return;
    }

    // 3. Single monitor verification
    if (displayInfo && !displayInfo.isSingleDisplay) {
      setSetupError(`Multiple monitors detected (${displayInfo.count} displays). Please disconnect external monitors.`);
      return;
    }

    setSetupError(null);

    // 4. Rules acceptance dialog
    const accepted = await window.electronAPI.showExamRules();
    if (!accepted) {
      return; // Cancelled by student
    }

    // 5. Initialize test
    await window.electronAPI.startTest(30);
    if (window.electronAPI?.getRemainingTime) {
      const initialRemaining = await window.electronAPI.getRemainingTime();
      setTime(initialRemaining);
    }
    if (window.electronAPI?.logAuditEvent) {
      await window.electronAPI.logAuditEvent({
        type: "EXAM_STARTED",
        durationMinutes: 30,
        displayCount: displayInfo.count,
      });
    }

    setStarted(true);
  }

  function formatTimeLeft(ms) {
    if (!ms || ms <= 0) return "00:00:00";

    const seconds = Math.floor((ms / 1000) % 60)
      .toString()
      .padStart(2, "0");

    const minutes = Math.floor((ms / (1000 * 60)) % 60)
      .toString()
      .padStart(2, "0");

    const hours = Math.floor(ms / (1000 * 60 * 60))
      .toString()
      .padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  }

  const hasActiveCamera = cameraReady && Boolean(videoRef.current?.srcObject);
  const isReadyToStart = hasActiveCamera && audioReady && displayInfo.isSingleDisplay;

  return (
    <div className="app-root">
      {/* Live Proctor Video PIP during active exam */}
      {started && (
        <div className="proctor-pip-badge">
          <video ref={videoRef} autoPlay playsInline muted className="pip-video" />
          <div className="pip-status-row">
            <span className="pip-red-dot"></span>
            <span className="pip-text">LIVE PROCTORING</span>
          </div>
        </div>
      )}

      {started ? (
        <MainExam
          formattedTime={formatTimeLeft(time)}
          remainingMs={time}
          audioStream={audioStreamRef.current}
          onEndTest={() => {
            if (window.confirm("Are you sure you want to exit the exam?")) {
              setStarted(false);
            }
          }}
        />
      ) : (
        <div className="page-container">
          <header className="hero-header">
            <div className="platform-tag">
              <span className="tag-dot"></span>
              <span>Athena Secure Examination Shell</span>
            </div>
            <h1>System Compatibility & Hardware Check</h1>
            <p className="hero-subtitle">
              Complete the security verifications below to unlock the examination environment.
            </p>
          </header>

          {setupError && (
            <div className="setup-alert-banner">
              <span className="alert-icon">⚠️</span>
              <span className="alert-text">{setupError}</span>
              <button className="alert-dismiss" onClick={() => setSetupError(null)}>✕</button>
            </div>
          )}

          <div className="card-container">
            {/* 1. Camera Verification */}
            <div className={`permission-item ${cameraReady ? "item-completed" : "item-pending"}`}>
              <div className="permission-icon-box">
                <span className="icon-symbol">📷</span>
              </div>
              <div className="permission-content">
                <div className="permission-header-row">
                  <div>
                    <h3>1. Camera Proctoring</h3>
                    <p>Live video feed is mandatory for automated proctoring snapshots.</p>
                  </div>
                  <span className={`status-pill ${cameraReady ? "pill-success" : "pill-warning"}`}>
                    {cameraReady ? "✓ Verified" : "Action Required"}
                  </span>
                </div>

                <div className="camera-preview-zone">
                  {cameraReady ? (
                    <div className="camera-stream-wrapper">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="onboarding-preview-video"
                      />
                      <div className="stream-badge">
                        <span className="live-dot"></span>
                        <span>Stream Live (Face Visible)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="camera-offline-wrapper">
                      <div className="offline-graphic">📷</div>
                      <p>Camera is currently disconnected or inactive.</p>
                    </div>
                  )}
                </div>

                <div className="action-row">
                  <button
                    onClick={getCamera}
                    className={`btn ${cameraReady ? "btn-success" : "btn-primary"}`}
                  >
                    {cameraReady ? "✓ Camera Re-connected" : "Enable Camera Access"}
                  </button>
                </div>
              </div>
            </div>

            <div className="card-divider" />

            {/* 2. Microphone Verification */}
            <div className={`permission-item ${audioReady ? "item-completed" : "item-pending"}`}>
              <div className="permission-icon-box">
                <span className="icon-symbol">🎙️</span>
              </div>
              <div className="permission-content">
                <div className="permission-header-row">
                  <div>
                    <h3>2. Ambient Audio Verification</h3>
                    <p>Microphone level calibration to detect sound and speech anomalies.</p>
                  </div>
                  <span className={`status-pill ${audioReady ? "pill-success" : "pill-warning"}`}>
                    {audioReady ? "✓ Calibrated" : "Action Required"}
                  </span>
                </div>

                <div className="action-row">
                  <button
                    onClick={getMicrophone}
                    className={`btn ${audioReady ? "btn-success" : "btn-primary"}`}
                  >
                    {audioReady ? "✓ Microphone Ready" : "Enable Microphone"}
                  </button>
                </div>
              </div>
            </div>

            <div className="card-divider" />

            {/* 3. Display Verification */}
            <div className={`permission-item ${displayInfo.isSingleDisplay ? "item-completed" : "item-danger"}`}>
              <div className="permission-icon-box">
                <span className="icon-symbol">🖥️</span>
              </div>
              <div className="permission-content">
                <div className="permission-header-row">
                  <div>
                    <h3>3. Display Security Check</h3>
                    <p>
                      {displayInfo.isSingleDisplay
                        ? "Single monitor detected. No external screens or projectors connected."
                        : `Violation: ${displayInfo.count} monitors detected! Secondary screens are prohibited.`}
                    </p>
                  </div>
                  <span className={`status-pill ${displayInfo.isSingleDisplay ? "pill-success" : "pill-danger"}`}>
                    {displayInfo.isSingleDisplay ? "✓ Single Screen" : "Multiple Displays"}
                  </span>
                </div>

                <div className="action-row">
                  <button onClick={refreshDisplays} className="btn btn-outline">
                    Re-check Displays
                  </button>
                </div>
              </div>
            </div>

            <div className="card-divider" />

            {/* 4. Fullscreen Mode */}
            <div className={`permission-item ${fullscreenReady ? "item-completed" : "item-pending"}`}>
              <div className="permission-icon-box">
                <span className="icon-symbol">⛶</span>
              </div>
              <div className="permission-content">
                <div className="permission-header-row">
                  <div>
                    <h3>4. Fullscreen Kiosk Mode</h3>
                    <p>Locks the application window to full screen to prevent desktop multi-tasking.</p>
                  </div>
                  <span className={`status-pill ${fullscreenReady ? "pill-success" : "pill-neutral"}`}>
                    {fullscreenReady ? "✓ Fullscreen Active" : "Optional Preview"}
                  </span>
                </div>

                <div className="action-row">
                  <button onClick={getFullscreen} className="btn btn-outline">
                    {fullscreenReady ? "✓ Fullscreen Engaged" : "Engage Fullscreen Now"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bottom-bar">
            <div className="readiness-summary">
              <span className={`readiness-indicator ${isReadyToStart ? "ready" : "not-ready"}`}></span>
              <span className="readiness-text">
                {isReadyToStart
                  ? "All requirements satisfied. You may now start your assessment."
                  : !hasActiveCamera
                  ? "Action needed: Please enable your camera above to unlock the exam."
                  : !audioReady
                  ? "Action needed: Please enable your microphone."
                  : "Action needed: Disconnect secondary displays."}
              </span>
            </div>

            <button
              onClick={startTest}
              className={`btn btn-launch ${isReadyToStart ? "btn-launch-active" : "btn-launch-disabled"}`}
              disabled={!isReadyToStart}
            >
              {isReadyToStart ? "Begin Proctored Exam →" : "Camera & Mic Required"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
