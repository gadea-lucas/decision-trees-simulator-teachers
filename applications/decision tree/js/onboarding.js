// js/onboarding.js
// Onboarding tutorial for ID3 Decision Tree web (Bootstrap + spotlight).
// - Forces a preset dataset during the tutorial (upload disabled).
// - Handles in-modal guided steps for Cloze and Theory export modals.
// - Can be restarted via the help button (window.restartOnboarding()).

const KEY_SEEN = "id3_onb_seen_v2";
const KEY_STEP = "id3_onb_step_v2";
const KEY_LOCK = "id3_onb_lock_v2"; // internal flag: tutorial currently running

// ---------- Small utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);

function isDisplayed(el) {
  if (!el) return false;
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return false;
  if (el.style && el.style.display === "none") return false;
  return true;
}

function waitForElement(selector, { requireDisplayed = false, root = document } = {}) {
  return new Promise((resolve) => {
    const existing = root.querySelector(selector);
    if (existing && (!requireDisplayed || isDisplayed(existing))) return resolve(existing);

    const obs = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el && (!requireDisplayed || isDisplayed(el))) {
        obs.disconnect();
        resolve(el);
      }
    });

    obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });
}

function waitForVisible(selector) {
  return new Promise(async (resolve) => {
    const el = await waitForElement(selector, { requireDisplayed: false });
    if (isDisplayed(el)) return resolve(el);

    const obs = new MutationObserver(() => {
      if (isDisplayed(el)) {
        obs.disconnect();
        resolve(el);
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["style", "class"] });
  });
}

function onOnce(el, eventName, handler, opts) {
  const fn = (e) => {
    el.removeEventListener(eventName, fn, opts);
    handler(e);
  };
  el.addEventListener(eventName, fn, opts);
  return () => el.removeEventListener(eventName, fn, opts);
}

// ---------- Bootstrap modal helpers ----------
function showBootstrapModal(modalEl) {
  const m = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: "static", keyboard: false });
  m.show();
  return m;
}

function getBootstrapModalInstance(modalEl) {
  return bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
}

function waitModalShown(modalId) {
  return new Promise((resolve) => {
    const el = document.getElementById(modalId);
    if (!el) return resolve();
    // if already shown
    if (el.classList.contains("show")) return resolve();
    onOnce(el, "shown.bs.modal", () => resolve());
  });
}

function waitModalHidden(modalId) {
  return new Promise((resolve) => {
    const el = document.getElementById(modalId);
    if (!el) return resolve();
    // if already hidden
    if (!el.classList.contains("show")) return resolve();
    onOnce(el, "hidden.bs.modal", () => resolve());
  });
}

// ---------- Tutorial state ----------
let currentStep = 0;
let currentTarget = null;
let cleanupAdvance = null;

function setStep(n) {
  localStorage.setItem(KEY_STEP, String(n));
}
function getStep() {
  const n = parseInt(localStorage.getItem(KEY_STEP) || "0", 10);
  return Number.isFinite(n) ? n : 0;
}
function markSeen() {
  localStorage.setItem(KEY_SEEN, "true");
  localStorage.removeItem(KEY_STEP);
  localStorage.removeItem(KEY_LOCK);
}
function isSeen() {
  return localStorage.getItem(KEY_SEEN) === "true";
}
function setLocked(isLocked) {
  if (isLocked) localStorage.setItem(KEY_LOCK, "true");
  else localStorage.removeItem(KEY_LOCK);
}
function isLocked() {
  return localStorage.getItem(KEY_LOCK) === "true";
}

// ---------- Lock UI during tutorial ----------
function lockUploadDuringTutorial(lock) {
  const uploadBtn = $('button[data-bs-target="#uploadModal"]');
  const fileInput = $("#csvFile");
  if (uploadBtn) uploadBtn.disabled = lock;
  if (fileInput) fileInput.disabled = lock;
}

function forcePickFirstPresetDataset() {
  const sel = $("#selectExData");
  if (!sel) return false;

  // If already picked something valid, keep it.
  if (sel.selectedIndex > 0) return true;

  // Pick first non-disabled option after placeholder.
  const idx = [...sel.options].findIndex((o, i) => i > 0 && !o.disabled);
  if (idx <= 0) return false;

  sel.selectedIndex = idx;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// Prevent the user from opening upload modal by any means (backdrop click etc.)
function ensureUploadModalClosed() {
  const el = $("#uploadModal");
  if (!el) return;
  const inst = getBootstrapModalInstance(el);
  if (el.classList.contains("show")) inst.hide();
}

// ---------- Spotlight UI (you add the HTML/CSS blocks described below) ----------
function spotlightEls() {
  return {
    spotlight: $("#onbSpotlight"),
    tip: $("#onbTip"),
    tipText: $("#onbTipText"),
    tipNext: $("#onbTipNext"),
    tipSkip: $("#onbTipSkip"),
  };
}

function showSpotlight() {
  const { spotlight } = spotlightEls();
  if (spotlight) spotlight.classList.remove("d-none");
}
function hideSpotlight() {
  const { spotlight } = spotlightEls();
  if (spotlight) spotlight.classList.add("d-none");
}

function highlight(el) {
  el.classList.add("onb-highlight");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  currentTarget = el;
}
function unhighlight() {
  if (currentTarget) {
    currentTarget.classList.remove("onb-highlight");
    currentTarget = null;
  }
}

function positionTip(targetEl) {
  const { tip } = spotlightEls();
  if (!tip) return;

  const r = targetEl.getBoundingClientRect();
  const pad = 12;

  const tipW = Math.min(380, window.innerWidth - 24);
  const approxH = 170;

  let top = r.bottom + pad;
  let left = Math.min(window.innerWidth - tipW - pad, Math.max(pad, r.left));

  if (top + approxH > window.innerHeight) {
    top = Math.max(pad, r.top - approxH - pad);
  }

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}

function cleanupStepArtifacts() {
  if (cleanupAdvance) {
    cleanupAdvance();
    cleanupAdvance = null;
  }
  unhighlight();
  hideSpotlight();
}

// ---------- Modals (welcome/done) ----------
function showWelcomeModal() {
  const el = $("#onbWelcomeModal");
  if (!el) return null;
  const inst = showBootstrapModal(el);

  el.querySelectorAll("[data-onb-skip]").forEach((b) => (b.onclick = () => finish()));
  el.querySelectorAll("[data-onb-next]").forEach((b) => (b.onclick = () => {
    inst.hide();
    next();
  }));

  return inst;
}

function showDoneModal() {
  const el = $("#onbDoneModal");
  if (!el) return null;
  const inst = showBootstrapModal(el);

  el.querySelectorAll("[data-onb-done]").forEach((b) => (b.onclick = () => {
    inst.hide();
    finish();
  }));

  return inst;
}

// ---------- Steps definition ----------
/**
 * Step types:
 * - welcome / done
 * - spotlight: { selector, text, advance?, allowManualNext?, waitVisible?, waitShownModal?, waitHiddenModal?, root? }
 *
 * root:
 *  - if you highlight inside a modal, pass root = '#clozeModal' or '#theoryModal'
 */
const steps = [
  { type: "welcome" },

  {
    type: "spotlight",
    selector: "#selectExData",
    text: "We’ll use a sample dataset (file upload is disabled during the tutorial).",
    allowManualNext: true,
    advance: { event: "change" },
  },

  {
    type: "spotlight",
    selector: "#dataInfoContainer",
    text: "Here you can see the dataset information and the resulting decision tree.",
    waitVisible: "#dataInfoContainer",
    allowManualNext: true,
  },

  {
    type: "spotlight",
    selector: "#btnStepForward",
    text: "Use these buttons to move forward and backward through the algorithm steps (they change the tree view).",
    waitVisible: "#stepByStepContainer",
    allowManualNext: true,
    advance: { event: "click" },
  },

  {
    type: "spotlight",
    selector: "#btnClozeConfig",
    text: "Now open the Cloze menu by clicking this button (for question export generated from the tree).",
    allowManualNext: false,
    advance: { event: "click" },
  },

  // ----- Cloze modal -----
  {
    type: "spotlight",
    waitShownModal: "clozeModal",
    selector: "#btnClozeAutofill",
    root: "#clozeModal",
    text: "“Auto-fill answers” automatically fills in suggested answers (you can edit them in the table).",
    allowManualNext: true,
  },
  {
    type: "spotlight",
    waitShownModal: "clozeModal",
    selector: "#clozeConfigRows",
    root: "#clozeModal",
    text: "In this table you configure which nodes are included, field type, answer, tolerance, hints...",
    allowManualNext: true,
  },
  {
    type: "spotlight",
    waitShownModal: "clozeModal",
    selector: "#btnClozeExportXml",
    root: "#clozeModal",
    text: "Export to Moodle XML (HTML works as a preview or alternative format.)",
    allowManualNext: true,
  },
  {
    type: "spotlight",
    waitShownModal: "clozeModal",
    selector: '#clozeModal [data-bs-dismiss="modal"]',
    root: "#clozeModal",
    text: "Close this modal to continue the tutorial.",
    allowManualNext: false,
    advance: { event: "click" },
  },

  {
    type: "spotlight",
    waitHiddenModal: "clozeModal",
    selector: "#btnExportTheory",
    text: "Now open the Theory menu (for theoretical questions about the tree export).",
    allowManualNext: false,
    advance: { event: "click" },
  },

  // ----- Theory modal -----
  {
    type: "spotlight",
    waitShownModal: "theoryModal",
    selector: "#theoryQuestionsContainer",
    root: "#theoryModal",
    text: "Here you’ll see the theoretical questions for the current step. You can edit, delete, or reorder them.",
    allowManualNext: true,
  },
  {
    type: "spotlight",
    waitShownModal: "theoryModal",
    selector: "#btnTheoryAddQuestion",
    root: "#theoryModal",
    text: "Use “Add question” to create a new theoretical question.",
    allowManualNext: true,
    advance: { event: "click" },
  },
  {
    type: "spotlight",
    waitShownModal: "theoryModal",
    selector: "#btnTheoryExportXml",
    root: "#theoryModal",
    text: "Export all these questions as Moodle XML.",
    allowManualNext: true,
  },
  {
    type: "spotlight",
    waitShownModal: "theoryModal",
    selector: '#theoryModal [data-bs-dismiss="modal"]',
    root: "#theoryModal",
    text: "Close this modal to finish the tutorial.",
    allowManualNext: false,
    advance: { event: "click" },
  },

  { type: "done" },
];


// ---------- Main runner ----------
async function runStep() {
  cleanupStepArtifacts();

  const step = steps[currentStep];
  if (!step) return finish();

  setStep(currentStep);

  // Keep upload locked throughout tutorial
  lockUploadDuringTutorial(true);
  ensureUploadModalClosed();

  if (step.type === "welcome") {
    showWelcomeModal();
    return;
  }

  if (step.type === "done") {
    showDoneModal();
    return;
  }

  if (step.waitShownModal) await waitModalShown(step.waitShownModal);
  if (step.waitHiddenModal) await waitModalHidden(step.waitHiddenModal);
  if (step.waitVisible) await waitForVisible(step.waitVisible);

  const rootEl = step.root ? document.querySelector(step.root) : document;
  const el = await waitForElement(step.selector, { requireDisplayed: true, root: rootEl });

  // Spotlight
  showSpotlight();
  highlight(el);

  const { tipText, tipNext, tipSkip } = spotlightEls();
  if (tipText) tipText.textContent = step.text || "";
  positionTip(el);

  if (tipSkip) tipSkip.onclick = () => finish();

  if (tipNext) {
    tipNext.style.display = step.allowManualNext ? "inline-block" : "none";
    tipNext.onclick = () => next();
  }

  // Advance by event
  if (step.advance?.event) {
    const ev = step.advance.event;

    const handler = () => {
      // Extra guard for example dataset: don't advance if still placeholder
      if (step.selector === "#selectExData") {
        const sel = $("#selectExData");
        if (sel && sel.selectedIndex <= 0) return;
      }
      next();
    };

    el.addEventListener(ev, handler, true);
    cleanupAdvance = () => el.removeEventListener(ev, handler, true);
  }
}

function next() {
  currentStep += 1;
  runStep();
}

function finish() {
  // Unlock upload again
  lockUploadDuringTutorial(false);

  cleanupStepArtifacts();

  // Hide onboarding bootstrap modals if open
  const wm = $("#onbWelcomeModal");
  const dm = $("#onbDoneModal");
  if (wm) getBootstrapModalInstance(wm).hide();
  if (dm) getBootstrapModalInstance(dm).hide();

  markSeen();
}

function startTutorial() {
  setLocked(true);

  // Force preset dataset at the start for a stable tutorial path
  forcePickFirstPresetDataset();

  currentStep = getStep();
  runStep();
}

function startIfNeeded() {
  if (isSeen()) return;
  startTutorial();
}

// Reposition tip on resize/scroll
function bindReposition() {
  const reposition = () => {
    if (currentTarget && !spotlightEls().spotlight?.classList.contains("d-none")) {
      positionTip(currentTarget);
    }
  };
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
}

document.addEventListener("DOMContentLoaded", () => {
  bindReposition();

  // Help button hook (optional)
  const helpBtn = $("#onbHelpBtn");
  if (helpBtn) helpBtn.addEventListener("click", () => window.restartOnboarding());

  startIfNeeded();
});

// Public API
window.restartOnboarding = function restartOnboarding() {
  localStorage.removeItem(KEY_SEEN);
  localStorage.removeItem(KEY_STEP);
  setLocked(true);

  // Close export modals if they are open (so tutorial starts clean)
  const cloze = $("#clozeModal");
  const theory = $("#theoryModal");
  const upload = $("#uploadModal");
  if (cloze) getBootstrapModalInstance(cloze).hide();
  if (theory) getBootstrapModalInstance(theory).hide();
  if (upload) getBootstrapModalInstance(upload).hide();

  lockUploadDuringTutorial(true);
  forcePickFirstPresetDataset();

  currentStep = 0;
  runStep();
};
