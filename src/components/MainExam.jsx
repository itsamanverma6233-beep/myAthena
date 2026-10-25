import { useEffect, useRef, useState } from "react";
import "./MainExam.css";
import { setupClipboardRestrictions } from "../utils/antiCheat";
import { startAudioMonitoring } from "../utils/audioMonitor";

const DEFAULT_QUESTIONS = [
  {
    id: 1,
    question: "Which of the following data structures operates on a Last In, First Out (LIFO) basis?",
    options: ["Queue", "Stack", "Binary Search Tree", "Linked List"],
    correctOption: 1,
  },
  {
    id: 2,
    question: "In Electron, which process is responsible for creating and controlling application windows?",
    options: [
      "Renderer Process",
      "Main Process",
      "Preload Script",
      "Service Worker",
    ],
    correctOption: 1,
  },
  {
    id: 3,
    question: "What is the average time complexity of searching an element in a balanced Binary Search Tree (AVL / Red-Black)?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    correctOption: 2,
  },
  {
    id: 4,
    question: "Which React hook is commonly used to perform side effects such as data subscriptions or DOM mutations?",
    options: ["useState", "useEffect", "useMemo", "useContext"],
    correctOption: 1,
  },
  {
    id: 5,
    question: "Which security mechanism prevents renderer processes in Electron from accessing Node.js APIs directly?",
    options: [
      "Context Isolation",
      "Node Integration enabled",
      "Content Security Policy",
      "Cross-Origin Resource Sharing",
    ],
    correctOption: 0,
  },
];

function MainExam({ formattedTime, remainingMs, audioStream, onEndTest }) {
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState(new Set([DEFAULT_QUESTIONS[0].id]));
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [warningToast, setWarningToast] = useState(null);
  const [strikes, setStrikes] = useState(0);
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [audioAlert, setAudioAlert] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const timerStartedRef = useRef(false);
  const MAX_STRIKES = 3;

  useEffect(() => {
    if (!audioStream) return;
    const cleanupAudio = startAudioMonitoring(audioStream, (level) => {
      setAudioAlert(true);
      setWarningToast(`Noise Spike Detected (${level}dB). Please maintain quiet examination environment.`);
      if (window.electronAPI?.logAuditEvent) {
        window.electronAPI.logAuditEvent({
          type: "VIOLATION_AUDIO_NOISE_SPIKE",
          volumeLevel: level,
        });
      }
      setTimeout(() => {
        setAudioAlert(false);
        setWarningToast(null);
      }, 4000);
    });
    return cleanupAudio;
  }, [audioStream]);

  function registerViolation(reason) {
    setStrikes((prev) => {
      const nextStrikes = prev + 1;
      setShowStrikeModal(true);
      if (window.electronAPI?.logAuditEvent) {
        window.electronAPI.logAuditEvent({
          type: "VIOLATION_WINDOW_BLUR",
          reason,
          strikeCount: nextStrikes,
          maxStrikes: MAX_STRIKES,
        });
      }
      if (nextStrikes >= MAX_STRIKES) {
        setTimeout(() => {
          alert("Maximum security violations exceeded. The exam will now be automatically submitted.");
          onEndTest();
        }, 800);
      }
      return nextStrikes;
    });
  }

  useEffect(() => {
    const cleanupClipboard = setupClipboardRestrictions((warningMsg) => {
      setWarningToast(warningMsg);
      setTimeout(() => setWarningToast(null), 3500);
    });

    let removeElectronBlur = null;
    if (window.electronAPI?.onWindowBlur) {
      removeElectronBlur = window.electronAPI.onWindowBlur(() => {
        registerViolation("Window focus was lost (switched away from exam window).");
      });
    }

    const browserBlurHandler = () => {
      registerViolation("Window focus was lost (switched away from exam window).");
    };
    window.addEventListener("blur", browserBlurHandler);

    return () => {
      cleanupClipboard();
      if (removeElectronBlur) removeElectronBlur();
      window.removeEventListener("blur", browserBlurHandler);
    };
  }, []);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  function goToQuestion(index) {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      setVisitedQuestions((prev) => new Set([...prev, questions[index].id]));
    }
  }

  function selectOption(optionIndex) {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIndex,
    }));
  }

  function clearResponse() {
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.id];
      return copy;
    });
  }

  function toggleMarkForReview() {
    setMarkedForReview((prev) => {
      const copy = new Set(prev);
      if (copy.has(currentQuestion.id)) {
        copy.delete(currentQuestion.id);
      } else {
        copy.add(currentQuestion.id);
      }
      return copy;
    });
  }

  function handleNext() {
    if (currentIndex < totalQuestions - 1) {
      goToQuestion(currentIndex + 1);
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      goToQuestion(currentIndex - 1);
    }
  }

  const answeredCount = Object.keys(selectedAnswers).filter(
    (id) => selectedAnswers[id] !== undefined && selectedAnswers[id] !== null
  ).length;

  async function handleFinalSubmit() {
    setShowSubmitModal(false);
    setIsSubmitted(true);
    if (window.electronAPI?.logAuditEvent) {
      await window.electronAPI.logAuditEvent({
        type: "EXAM_SUBMITTED",
        answeredCount,
        totalQuestions,
        markedCount: markedForReview.size,
        strikes,
      });
    }
  }

  useEffect(() => {
    if (typeof remainingMs === "number" && remainingMs > 1000) {
      timerStartedRef.current = true;
    }
  }, [remainingMs]);

  useEffect(() => {
    // Only auto-submit if the timer was legitimately started and has now reached 0
    if (timerStartedRef.current && typeof remainingMs === "number" && remainingMs <= 0 && !isSubmitted) {
      handleFinalSubmit();
    }
  }, [remainingMs, isSubmitted]);

  if (isSubmitted) {
    return (
      <div className="exam-page completion-page">
        <div className="completion-card">
          <div className="completion-icon">✅</div>
          <h2>Assessment Completed</h2>
          <p className="completion-subtext">
            Your examination responses have been securely recorded.
          </p>

          <div className="completion-summary-grid">
            <div className="summary-box">
              <span className="summary-box-num">{answeredCount}</span>
              <span className="summary-box-label">Answered</span>
            </div>
            <div className="summary-box">
              <span className="summary-box-num">{totalQuestions - answeredCount}</span>
              <span className="summary-box-label">Unanswered</span>
            </div>
            <div className="summary-box">
              <span className="summary-box-num">{strikes}</span>
              <span className="summary-box-label">Violations</span>
            </div>
          </div>

          <div className="completion-audit-notice">
            <span>🔒 Proctoring audit logs and webcam snapshots have been archived for review.</span>
          </div>

          <button className="btn btn-primary btn-exit" onClick={onEndTest}>
            Exit Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-page">
      <header className="exam-header">
        <div className="exam-brand">
          <span className="exam-title">Athena Assessment Platform</span>
        </div>
        <div className="exam-header-center">
          <div className="exam-timer-box">
            <span className="timer-label">Time Remaining:</span>
            <span className="timer-val">{formattedTime || "00:30:00"}</span>
          </div>
          <div className={`audio-proctor-badge ${audioAlert ? "audio-alert" : ""}`}>
            <span>{audioAlert ? "🔊 Noise Alert!" : "🎙️ Mic Active"}</span>
          </div>
          <div className={`violation-badge ${strikes > 0 ? "violation-active" : ""}`}>
            <span>⚠️ Violations: {strikes}/{MAX_STRIKES}</span>
          </div>
        </div>
        <button className="btn-end-exam" onClick={() => setShowSubmitModal(true)}>
          Submit Exam
        </button>
      </header>

      {warningToast && (
        <div className="anti-cheat-toast">
          <span className="toast-icon">⚠️</span>
          <span>{warningToast}</span>
        </div>
      )}

      {showStrikeModal && (
        <div className="strike-modal-backdrop">
          <div className="strike-modal-card">
            <div className="strike-modal-header">
              <span className="strike-icon">🚨</span>
              <h3>Security Violation Warning</h3>
            </div>
            <p className="strike-modal-body">
              <strong>Strike {strikes} of {MAX_STRIKES}:</strong> The exam window lost focus or an external application was switched to.
            </p>
            <p className="strike-modal-subtext">
              Navigating outside the proctored test environment violates test integrity. Accumulating {MAX_STRIKES} strikes will result in immediate test termination.
            </p>
            <button
              className="btn btn-strike-ack"
              onClick={() => setShowStrikeModal(false)}
            >
              I Understand & Acknowledge
            </button>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="strike-modal-backdrop">
          <div className="strike-modal-card submit-modal-card">
            <div className="strike-modal-header">
              <span className="strike-icon">📋</span>
              <h3>Confirm Final Submission</h3>
            </div>
            <div className="submit-summary-table">
              <div className="summary-row">
                <span>Total Questions:</span>
                <strong>{totalQuestions}</strong>
              </div>
              <div className="summary-row text-success">
                <span>Answered:</span>
                <strong>{answeredCount}</strong>
              </div>
              <div className="summary-row text-warning">
                <span>Unanswered:</span>
                <strong>{totalQuestions - answeredCount}</strong>
              </div>
              <div className="summary-row text-purple">
                <span>Marked for Review:</span>
                <strong>{markedForReview.size}</strong>
              </div>
            </div>
            <p className="strike-modal-subtext">
              Are you sure you want to conclude the exam? Once submitted, answers cannot be modified.
            </p>
            <div className="modal-actions-row">
              <button
                className="btn btn-secondary"
                onClick={() => setShowSubmitModal(false)}
              >
                Return to Exam
              </button>
              <button
                className="btn btn-primary btn-confirm-submit"
                onClick={handleFinalSubmit}
              >
                Yes, Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="exam-main-content">
        <div className="question-card">
          <div className="question-meta">
            <span className="question-number-badge">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
          </div>

          <h2 className="question-prompt">{currentQuestion.question}</h2>

          <div className="options-list">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedAnswers[currentQuestion.id] === idx;
              return (
                <label
                  key={idx}
                  className={`option-card ${isSelected ? "option-selected" : ""}`}
                  onClick={() => selectOption(idx)}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={isSelected}
                    onChange={() => selectOption(idx)}
                  />
                  <span className="option-indicator">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="option-text">{option}</span>
                </label>
              );
            })}
          </div>

          <div className="exam-nav-bar">
            <div className="nav-left-actions">
              <button
                className="btn btn-secondary"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
              >
                ← Previous
              </button>
              <button
                className={`btn btn-review ${markedForReview.has(currentQuestion.id) ? "active" : ""}`}
                onClick={toggleMarkForReview}
              >
                {markedForReview.has(currentQuestion.id) ? "★ Marked for Review" : "☆ Mark for Review"}
              </button>
              <button
                className="btn btn-clear"
                onClick={clearResponse}
                disabled={selectedAnswers[currentQuestion.id] === undefined}
              >
                Clear Answer
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={currentIndex === totalQuestions - 1}
            >
              Next →
            </button>
          </div>
        </div>

        <aside className="exam-palette-card">
          <h3 className="palette-title">Question Palette</h3>
          <div className="palette-stats">
            <span className="stat-pill stat-answered">Answered: {answeredCount}</span>
            <span className="stat-pill stat-review">Review: {markedForReview.size}</span>
            <span className="stat-pill stat-unanswered">
              Remaining: {totalQuestions - answeredCount}
            </span>
          </div>

          <div className="palette-grid">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered =
                selectedAnswers[q.id] !== undefined && selectedAnswers[q.id] !== null;
              const isVisited = visitedQuestions.has(q.id);
              const isMarked = markedForReview.has(q.id);

              let statusClass = "status-not-visited";
              if (isMarked) {
                statusClass = "status-marked";
              } else if (isAnswered) {
                statusClass = "status-answered";
              } else if (isVisited) {
                statusClass = "status-visited";
              }

              return (
                <button
                  key={q.id}
                  className={`palette-item ${statusClass} ${isCurrent ? "item-active" : ""}`}
                  onClick={() => goToQuestion(idx)}
                  title={`Question ${idx + 1}`}
                >
                  {q.id}
                  {isMarked && <span className="mini-badge-star">★</span>}
                </button>
              );
            })}
          </div>

          <div className="palette-legend">
            <div className="legend-item">
              <span className="legend-dot dot-answered"></span> Answered
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-review"></span> Marked for Review
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-visited"></span> Visited
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-not-visited"></span> Unvisited
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default MainExam;
