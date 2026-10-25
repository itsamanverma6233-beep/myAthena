/**
 * Web Audio API helper to monitor ambient noise levels during examinations.
 */

export function startAudioMonitoring(stream, onNoiseAlert) {
  if (!stream || !window.AudioContext) return () => {};

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let consecutiveSpikes = 0;
    const NOISE_THRESHOLD = 85; // volume threshold out of 255

    const intervalId = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;

      if (avg > NOISE_THRESHOLD) {
        consecutiveSpikes++;
        if (consecutiveSpikes >= 2) {
          if (typeof onNoiseAlert === "function") {
            onNoiseAlert(Math.round(avg));
          }
          consecutiveSpikes = 0;
        }
      } else {
        consecutiveSpikes = Math.max(0, consecutiveSpikes - 1);
      }
    }, 600);

    return function cleanup() {
      clearInterval(intervalId);
      source.disconnect();
      audioContext.close();
    };
  } catch (err) {
    console.warn("[myAthena] Audio monitoring failed to initialize:", err);
    return () => {};
  }
}
