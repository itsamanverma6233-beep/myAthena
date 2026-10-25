/**
 * Anti-cheat utilities to protect examination integrity.
 */

export function setupClipboardRestrictions(onViolation) {
  function handleCopyCut(e) {
    e.preventDefault();
    if (typeof onViolation === "function") {
      onViolation("Clipboard action (Copy/Cut) is prohibited during the examination.");
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    if (typeof onViolation === "function") {
      onViolation("Pasting content is prohibited during the examination.");
    }
  }

  function handleContextMenu(e) {
    e.preventDefault();
    if (typeof onViolation === "function") {
      onViolation("Context menu is disabled.");
    }
  }

  window.addEventListener("copy", handleCopyCut);
  window.addEventListener("cut", handleCopyCut);
  window.addEventListener("paste", handlePaste);
  window.addEventListener("contextmenu", handleContextMenu);

  return function cleanup() {
    window.removeEventListener("copy", handleCopyCut);
    window.removeEventListener("cut", handleCopyCut);
    window.removeEventListener("paste", handlePaste);
    window.removeEventListener("contextmenu", handleContextMenu);
  };
}
