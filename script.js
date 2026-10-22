const state = {
  data: null,
  gender: null,
  currentIndex: 0,
  answers: {},
  currentResult: null,
  audio: null,
  audioEnabled: true
};

const screens = {
  loading: document.querySelector("#loading-screen"),
  home: document.querySelector("#home-screen"),
  gender: document.querySelector("#gender-screen"),
  quiz: document.querySelector("#quiz-screen"),
  result: document.querySelector("#result-screen")
};

const els = {
  startBtn: document.querySelector("#start-btn"),
  channelBtns: document.querySelectorAll(".channel-btn"),
  questionKicker: document.querySelector("#question-kicker"),
  quizTitle: document.querySelector("#quiz-title"),
  progressCount: document.querySelector("#progress-count"),
  progressBar: document.querySelector("#progress-bar"),
  questionCard: document.querySelector("#question-card"),
  questionText: document.querySelector("#question-text"),
  optionsList: document.querySelector("#options-list"),
  infoNextBtn: document.querySelector("#info-next-btn"),
  prevBtn: document.querySelector("#prev-btn"),
  resultName: document.querySelector("#result-name"),
  resultScore: document.querySelector("#result-score"),
  tieNote: document.querySelector("#tie-note"),
  resultImage: document.querySelector("#result-image"),
  resultBlur: document.querySelector("#result-blur"),
  resultText: document.querySelector("#result-text"),
  rankingList: document.querySelector("#ranking-list"),
  copyBtn: document.querySelector("#copy-btn"),
  restartBtn: document.querySelector("#restart-btn"),
  copyStatus: document.querySelector("#copy-status"),
  audioToggle: document.querySelector("#audio-toggle")
};

function updateAudioButton() {
  if (!els.audioToggle) {
    return;
  }
  const isMuted = !state.audioEnabled;
  els.audioToggle.textContent = isMuted ? "MUTE" : "ON AIR";
  els.audioToggle.classList.toggle("is-muted", isMuted);
  els.audioToggle.setAttribute("aria-pressed", String(!isMuted));
}

function tryPlayAudio() {
  if (!state.audio || !state.audioEnabled) {
    return;
  }
  const playAttempt = state.audio.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      updateAudioButton();
    });
  }
}

function setupAudio() {
  const source = state.data?.siteAssets?.audio || state.data?.music?.source;
  const enabled = state.data?.music?.enabled !== false && Boolean(source);
  if (!enabled) {
    state.audioEnabled = false;
    updateAudioButton();
    return;
  }

  state.audio = new Audio(source);
  state.audio.loop = true;
  state.audio.preload = "auto";
  state.audio.volume = 0.45;
  updateAudioButton();
  tryPlayAudio();
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getQuestions() {
  return state.data.questions.filter((question) => question.gender === state.gender);
}

function getRoles() {
  return state.data.roles.filter((role) => role.gender === state.gender);
}

function formatNumber(number) {
  return Number.isFinite(number) ? `${number}%` : "0%";
}

function renderQuestion() {
  const questions = getQuestions();
  const question = questions[state.currentIndex];
  const current = state.currentIndex + 1;
  const total = questions.length;
  const isInfo = question.type === "info" || question.scored === false;

  els.questionKicker.textContent = `第 ${String(current).padStart(2, "0")} 段訊號`;
  els.quizTitle.textContent = isInfo ? "雷點私訊提示" : "請選擇你的篝火頻率";
  els.progressCount.textContent = `${current} / ${total}`;
  els.progressBar.style.width = `${(current / total) * 100}%`;
  els.questionText.textContent = question.text;
  els.optionsList.innerHTML = "";
  els.questionCard.classList.toggle("is-info", isInfo);
  els.infoNextBtn.textContent = question.buttonText || "我知道了，繼續調頻";
  els.prevBtn.disabled = state.currentIndex === 0;

  if (isInfo) {
    return;
  }

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = option.text;
    button.dataset.optionId = option.id;
    if (state.answers[question.id] === option.id) {
      button.classList.add("is-selected");
    }
    button.addEventListener("click", () => {
      state.answers[question.id] = option.id;
      document.querySelectorAll(".option-btn").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
      window.setTimeout(goNext, 160);
    });
    els.optionsList.appendChild(button);
  });
}

function goNext() {
  const questions = getQuestions();
  if (state.currentIndex < questions.length - 1) {
    state.currentIndex += 1;
    renderQuestion();
    return;
  }
  renderResult();
}

function computeScores() {
  const roles = getRoles();
  const roleIds = new Set(roles.map((role) => role.roleId));
  const scores = Object.fromEntries(roles.map((role) => [role.roleId, 0]));

  getQuestions().forEach((question) => {
    if (question.type === "info" || question.scored === false) {
      return;
    }

    const selectedId = state.answers[question.id];
    const selected = question.options.find((option) => option.id === selectedId);
    if (!selected || !selected.score) {
      return;
    }

    Object.entries(selected.score).forEach(([roleId, value]) => {
      if (roleIds.has(roleId)) {
        scores[roleId] += Number(value) || 0;
      }
    });
  });

  return scores;
}

function renderResult() {
  const scores = computeScores();
  const rows = getRoles()
    .map((role) => {
      const rawScore = scores[role.roleId] || 0;
      const percentage = role.maxScore ? Math.round((rawScore / role.maxScore) * 100) : 0;
      return { ...role, rawScore, percentage };
    })
    .sort((a, b) => b.percentage - a.percentage || b.rawScore - a.rawScore);

  const top = rows[0];
  state.currentResult = top;
  const isTie = rows.length > 1 && rows[0].percentage === rows[1].percentage;
  const scoreLabel = top.percentage < 0 ? "頻率偏離" : "頻率共振值";

  els.resultName.textContent = top.roleName;
  els.resultScore.textContent = `${scoreLabel}｜${formatNumber(top.percentage)}`;
  els.tieNote.classList.toggle("is-visible", isTie);
  els.resultImage.src = top.coverImage;
  els.resultImage.alt = `${top.roleName}角色封面`;
  els.resultBlur.src = top.coverImage;

  els.resultText.innerHTML = "";
  top.resultText.split("\n").filter(Boolean).forEach((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    els.resultText.appendChild(paragraph);
  });

  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.percentage)), 100);
  els.rankingList.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = `rank-row${row.percentage < 0 ? " is-negative" : ""}`;

    const name = document.createElement("span");
    name.className = "rank-name";
    name.textContent = row.roleName;

    const track = document.createElement("div");
    track.className = "rank-track";
    const fill = document.createElement("span");
    fill.className = "rank-fill";
    fill.style.width = `${Math.min(100, Math.abs(row.percentage) / maxAbs * 100)}%`;
    track.appendChild(fill);

    const score = document.createElement("span");
    score.className = "rank-score";
    score.textContent = formatNumber(row.percentage);

    item.append(name, track, score);
    els.rankingList.appendChild(item);
  });

  showScreen("result");
}

async function copyResult() {
  if (!state.currentResult) {
    return;
  }
  const result = state.currentResult;
  const text = `我在聚散電台測到了《諸神吹滅篝火》的「${result.roleName}」\n匹配度：${result.percentage}%\n\n我的情緒頻率已接入《諸神吹滅篝火》。\n你的頻率會接收到誰？\n\n好劇好散推理館｜The Truth Frequency\n—— 今夜，真相屬於你。 ——`;

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  els.copyStatus.textContent = "已複製結果訊號。";
}

async function init() {
  try {
    const response = await fetch("quiz.json", { cache: "no-store" });
    state.data = await response.json();
    setupAudio();
    window.setTimeout(() => showScreen("home"), 650);
  } catch (error) {
    els.questionText.textContent = "訊號接入失敗，請重新整理頁面。";
    showScreen("quiz");
  }
}

els.startBtn.addEventListener("click", () => showScreen("gender"));

document.addEventListener("pointerdown", tryPlayAudio, { once: true });

els.audioToggle.addEventListener("click", () => {
  if (!state.audio) {
    return;
  }

  if (state.audio.paused) {
    state.audioEnabled = true;
    updateAudioButton();
    tryPlayAudio();
    return;
  }

  state.audioEnabled = false;
  state.audio.pause();
  updateAudioButton();
});

els.channelBtns.forEach((button) => {
  button.addEventListener("click", () => {
    state.gender = button.dataset.gender;
    state.currentIndex = 0;
    state.answers = {};
    state.currentResult = null;
    renderQuestion();
    showScreen("quiz");
  });
});

els.infoNextBtn.addEventListener("click", goNext);

els.prevBtn.addEventListener("click", () => {
  if (state.currentIndex > 0) {
    state.currentIndex -= 1;
    renderQuestion();
  }
});

els.copyBtn.addEventListener("click", copyResult);

els.restartBtn.addEventListener("click", () => {
  state.gender = null;
  state.currentIndex = 0;
  state.answers = {};
  state.currentResult = null;
  els.copyStatus.textContent = "";
  showScreen("home");
});

init();
