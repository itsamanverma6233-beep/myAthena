# 🎓 Project Discussion & Development Log: myAthena

**Project:** myAthena - Secure Examination & Proctoring Desktop App  
**Student:** Aman Verma (2nd Year Computer Science)  
**AI Mentor:** Antigravity Pair-Programming Assistant  
**Tech Stack:** Electron, React, Vite, Node.js  

---

### **1. Project Idea & Why Electron?**

**Aman:**  
> Hey! For my college project, I want to build an online exam app called **myAthena** that prevents cheating. I know React, but I'm thinking of using Electron too. Why do we need Electron instead of just making a normal website?

**AI Mentor:**  
> That's a great project idea! 
> 
> A regular website runs inside Chrome or Edge, which limits what you can control — students can easily open tabs, use multiple monitors, or open Inspect Element. 
> 
> With **Electron**, you wrap your React app inside a desktop application. This gives you direct access to the computer's operating system:
> - You can force **fullscreen kiosk mode** (so they can't minimize or see the taskbar).
> - You can detect all connected screens.
> - You can block keyboard shortcuts like `F12` (DevTools) and `Ctrl+C` / `Ctrl+V`.

---

### **2. Running Vite and Electron Together**

**Aman:**  
> That makes sense! But how do we run Vite and Electron together during development? Do I have to open two different terminals every time?

**AI Mentor:**  
> You don't have to! We can write a small runner script called `scripts/dev.mjs`. 
> 
> It starts the Vite dev server first, waits until `http://localhost:5173` is ready, and then automatically launches Electron. When you close the app window, it also stops Vite so no background processes keep running.

**Aman:**  
> That's super convenient. Let's set that up along with the basic project structure.

---

### **3. Blocking Shortcuts & Inspect Element**

**Aman:**  
> How do we prevent students from opening DevTools or right-clicking to inspect the questions?

**AI Mentor:**  
> In Electron's `main.cjs`, we can listen to window events:
> 1. Disable the right-click menu:
>    ```javascript
>    win.webContents.on("context-menu", (e) => e.preventDefault());
>    ```
> 2. Block shortcut keys using `before-input-event`:
>    We check if the pressed key is `F12`, `Ctrl+Shift+I` (DevTools), `F5` / `Ctrl+R` (Reload), or `Ctrl+P` (Print), and call `event.preventDefault()`.
> 3. In the React frontend, we also add listeners to block `copy`, `cut`, and `paste` actions.

**Aman:**  
> Simple enough. Let's add those restrictions so students can't copy questions or inspect elements.

---

### **4. Detecting Secondary Monitors**

**Aman:**  
> What if a student connects an extra monitor or TV using an HDMI cable to look up answers? Can we detect that from our app?

**AI Mentor:**  
> Yes! Electron has a built-in `screen` module in the main process. 
> 
> We can call `screen.getAllDisplays()`. If `displays.length > 1`, it means more than one monitor is plugged in. 
> 
> We can pass this info to React using an IPC handler (`check-displays`). In the UI, if more than 1 display is detected, we show a red warning banner: *"Violation: Multiple monitors detected!"* and disable the start button until they unplug the external screen.

**Aman:**  
> Awesome, that will completely stop people from using a second screen! Let's code that.

---

### **5. Tab Switching & Focus Loss (Strikes)**

**Aman:**  
> How do we know if a student clicks outside the exam window or tries to switch applications with `Alt+Tab`?

**AI Mentor:**  
> Whenever an application loses focus, the operating system fires a `blur` event.
> 
> 1. In Electron, `win.on("blur")` detects whenever the student clicks away.
> 2. It sends an alert message to React.
> 3. In React, we give them a **Strike System**:
>    - **Strike 1 & 2:** A popup warning appears: *"You navigated away from the exam! Strike X of 3."*
>    - **Strike 3:** The exam auto-submits immediately and ends the test.

**Aman:**  
> That is a really clean way to handle it. Three strikes and they are out. Let's implement that!

---

### **6. Audio & Webcam Proctoring**

**Aman:**  
> For proctoring, how do we take webcam pictures of the student, and how can we check if someone is talking in the room? I don't want to save huge audio files on the computer.

**AI Mentor:**  
> For the webcam:
> - We use `navigator.mediaDevices.getUserMedia` to show a live camera feed.
> - Every 5 seconds, we take a snapshot frame and send it to Electron, which saves it into a `cameraFeed/` folder with a timestamp.
> 
> For audio:
> - Instead of saving audio files, we use the browser's **Web Audio API** (`AudioContext` and `AnalyserNode`).
> - It constantly reads the volume level (0 to 255).
> - If the volume goes above a threshold (like `85`) two times in a row, it flags a noise alert and logs it to `audit_log.json`.

**Aman:**  
> That's really clever — we only measure sound levels instead of saving heavy audio recordings. Let's add both!

---

### **7. Building the Exam Page & Question Palette**

**Aman:**  
> Now let's make the exam interface. I want:
> - Next and Previous buttons
> - A "Mark for Review" button
> - A grid on the right side showing question numbers (Green for Answered, Purple for Review, Orange for Visited, Grey for Unvisited).
> 
> How should I store this in React state?

**AI Mentor:**  
> We can keep it very simple with three states:
> 1. `selectedAnswers`: An object `{ 1: 0, 2: 3 }` mapping question ID to the chosen option.
> 2. `visitedQuestions`: A `Set` storing IDs of questions the student has viewed.
> 3. `markedForReview`: A `Set` storing IDs of questions flagged for review.
> 
> For each question button in the palette:
> - If it's in `markedForReview` -> purple with a star.
> - Else if it's in `selectedAnswers` -> green.
> - Else if it's in `visitedQuestions` -> orange.
> - Otherwise -> grey.

**Aman:**  
> Got it, using `Set` makes it really easy to add and remove questions. Let's build the component and CSS.

---

### **8. Debugging: Why is the Exam Ending Instantly?**

**Aman:**  
> Hey, I tried testing the exam, but as soon as I click "Begin Proctored Exam", it immediately ends and says "Assessment Completed"! Why is it submitting right after starting?

**AI Mentor:**  
> Good catch! Here is why that happened:
> 
> 1. In `App.jsx`, the timer state starts at `0`.
> 2. When you click start, `MainExam.jsx` loads.
> 3. Inside `MainExam.jsx`, we had an effect:
>    ```javascript
>    if (remainingMs <= 0) handleFinalSubmit();
>    ```
> 4. Because Electron takes a few milliseconds to calculate and send the real 30 minutes, `remainingMs` is `0` on the very first frame! The component thought time ran out and submitted immediately.
> 
> **How we fix it:**
> We add a guard `useRef`:
> ```javascript
> const timerStartedRef = useRef(false);
> 
> useEffect(() => {
>   if (remainingMs > 1000) timerStartedRef.current = true;
> }, [remainingMs]);
> 
> useEffect(() => {
>   if (timerStartedRef.current && remainingMs <= 0 && !isSubmitted) {
>     handleFinalSubmit();
>   }
> }, [remainingMs, isSubmitted]);
> ```
> Now it will only submit when the timer has actually started counting down and reaches zero.

**Aman:**  
> Oh wow, that makes total sense! It was reading the initial 0 before the countdown even started. Let's fix that!

---

### **9. Organizing Git Commits**

**Aman:**  
> It's working perfectly now! Camera, mic, display check, timer, and questions all work. I need to push this to my GitHub repository (`myAthena`), but I want to divide the work into 15 logical commits so my commit history looks clean and well-structured. How should we divide them?

**AI Mentor:**  
> We can divide your commits logically by feature:
> 1. `chore(setup)`: Base React, Vite, and Electron configuration
> 2. `feat(electron)`: Frameless window setup
> 3. `feat(scripts)`: Development startup script (`dev.mjs`)
> 4. `feat(ipc)`: Preload bridge for safe communication
> 5. `feat(security)`: Multi-monitor detection
> 6. `feat(timer)`: Exam countdown timer in main process
> 7. `feat(proctoring)`: Webcam snapshot saving
> 8. `feat(audit)`: Security audit logger
> 9. `feat(rules)`: Exam rules dialog
> 10. `feat(anti-cheat)`: Shortcut blocking and window blur detection
> 11. `feat(audio)`: Ambient sound level monitor
> 12. `feat(ui)`: Hardware check onboarding screen
> 13. `feat(exam)`: Question palette and strike warning modal
> 14. `feat(exam)`: Live webcam PIP badge and auto-submit integration
> 15. `docs`: Full README documentation
> 
> We can commit and push each one step-by-step to your GitHub repo.

**Aman:**  
> Perfect! Let's commit them one by one.
