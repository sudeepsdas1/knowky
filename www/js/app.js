/* Knowky – main app logic.
   Everything lives in memory only (no database, nothing saved).
   Other players in Trivia are simulated on the device so the app works fully offline. */
(function () {
  "use strict";

  // ---------------------------------------------------------------- helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const titleCase = (s) => s.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  function shade(hex, amt) { // amt -1..1 (negative = darker)
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  const FACTS = window.KNOWKY_FACTS;
  const TOPICS = window.KNOWKY_TOPICS;
  const TOPIC = Object.fromEntries(TOPICS.map((t) => [t.name, t]));

  const QUESTIONS_PER_MATCH = 20;
  const SECONDS_PER_QUESTION = 30;
  const POINTS_NEW_FACT = 10;
  const POINTS_EXPLAIN = 5;
  const RATING_WIN = 30, RATING_LOSS = -20, RATING_DRAW = 5;
  const AVATARS = ["🦊", "🐼", "🦁", "🐯", "🐸", "🐵", "🦄", "🐙", "🐧", "🐨", "🦖", "🐬"];

  // ---------------------------------------------------------------- state (memory only)
  const state = {
    name: "Explorer",
    avatar: "🦊",
    points: 0,
    seenFacts: new Set(),
    explainedFacts: new Set(),
    rating: 1000,
    wins: 0, losses: 0, draws: 0,
    played: 0,
    soloBest: null,
    history: [],
    tab: "facts",
    factFilter: "All",
    myChallenges: [],
    globalChallenges: [],
    inMatch: false,
  };

  // ---------------------------------------------------------------- simulated players
  const BOT_NAMES = ["Aarav", "Zara", "Kabir", "Mia", "Ishaan", "Ananya", "Leo", "Sara", "Vivaan", "Noah", "Diya", "Aisha", "Arjun", "Emma", "Rohan", "Meera", "Yusuf", "Lily", "Advik", "Tara", "Omar", "Kiara", "Ethan", "Saanvi"];
  const BOT_SUFFIX = ["", "", "_Star", "_Quiz", "123", "_Pro", "Kid", "_GK", "99", "_Brainy"];
  function makeBot() {
    const skillBase = 0.58 + (state.rating - 1000) / 1600;
    return {
      name: pick(BOT_NAMES) + pick(BOT_SUFFIX),
      avatar: pick(AVATARS),
      skill: clamp(skillBase + rand(-0.12, 0.12), 0.4, 0.9),
    };
  }
  const SEED_LABELS = [
    ["Planets", "Space"], ["Solar System", "Space"], ["Astronauts", "Space"],
    ["T-Rex", "Dinosaurs"], ["Fossils", "Dinosaurs"], ["Dinosaurs", "Dinosaurs"],
    ["Sea Creatures", "Oceans"], ["Sharks", "Oceans"], ["Oceans", "Oceans"],
    ["Wild Animals", "Animals"], ["Birds", "Animals"], ["Insects", "Animals"],
    ["Human Body", "Human Body"], ["Bones", "Human Body"], ["Brain", "Human Body"],
    ["Countries", "Earth & Geography"], ["Capitals", "Earth & Geography"], ["Mountains", "Earth & Geography"],
    ["Experiments", "Science"], ["Magnets", "Science"], ["Energy", "Science"],
    ["Indian History", "History"], ["Ancient Egypt", "History"], ["Famous People", "History"],
  ];
  function makeGlobalChallenge() {
    const [label, topic] = pick(SEED_LABELS);
    return { id: Math.random().toString(36).slice(2), label, topic, host: makeBot(), mins: Math.floor(rand(1, 15)) };
  }

  // ---------------------------------------------------------------- UI basics
  function toast(msg) {
    const t = el(`<div class="toast">${esc(msg)}</div>`);
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 2300);
  }
  function bump(id) { const p = $(id).parentElement; p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump"); }

  function updateHeader() {
    $("#hdr-points").textContent = state.points;
    $("#hdr-rating").textContent = state.rating;
  }

  function addPoints(n, msg) {
    state.points += n;
    updateHeader(); bump("#hdr-points");
    toast(`+${n} ⭐ ${msg}`);
  }

  function confetti() {
    const colors = ["#FF6B4A", "#FFC93C", "#2EC4B6", "#6C5CE7", "#E84393", "#22B573"];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement("i");
      c.className = "confetti";
      c.style.left = rand(0, 100) + "vw";
      c.style.background = pick(colors);
      c.style.animationDuration = rand(1.8, 3.4) + "s";
      c.style.animationDelay = rand(0, 0.6) + "s";
      c.style.transform = `rotate(${rand(0, 360)}deg)`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }

  function showModal({ emoji = "", title, text = "", actions }) {
    const wrap = $("#modal");
    wrap.innerHTML = "";
    const m = el(`<div class="modal">
        ${emoji ? `<div class="m-emoji">${emoji}</div>` : ""}
        <h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ""}
        <div class="m-actions"></div></div>`);
    actions.forEach((a) => {
      const b = el(`<button class="btn ${a.primary ? "btn-primary" : "btn-ghost"}">${esc(a.label)}</button>`);
      b.onclick = () => { closeModal(); a.onClick && a.onClick(); };
      $(".m-actions", m).appendChild(b);
    });
    wrap.appendChild(m);
    wrap.classList.remove("hidden");
  }
  function closeModal() { $("#modal").classList.add("hidden"); $("#modal").innerHTML = ""; }
  const modalOpen = () => !$("#modal").classList.contains("hidden");

  // ---------------------------------------------------------------- tabs
  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + tab));
    if (tab === "trivia") renderTrivia();
    if (tab === "profile") renderProfile();
  }
  document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

  // ================================================================ KNOWKY FACTS
  const feed = $("#feed");
  let feedCount = 0;
  let lastBatchEnd = -1;

  function renderFilters() {
    const row = $("#fact-filters");
    row.innerHTML = "";
    ["All", ...TOPICS.map((t) => t.name)].forEach((name) => {
      const label = name === "All" ? "✨ All" : `${TOPIC[name].emoji} ${name}`;
      const c = el(`<button class="chip ${state.factFilter === name ? "active" : ""}">${esc(label)}</button>`);
      c.onclick = () => { state.factFilter = name; renderFilters(); buildFeed(); };
      row.appendChild(c);
    });
  }

  const slideObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting || e.intersectionRatio < 0.6) return;
      const slide = e.target;
      const id = Number(slide.dataset.id);
      if (!state.seenFacts.has(id)) {
        state.seenFacts.add(id);
        addPoints(POINTS_NEW_FACT, "New fact discovered!");
      }
      document.querySelectorAll(`.fact-slide[data-id="${id}"] .seen-badge`).forEach((b) => (b.textContent = "✓ Explored"));
      if (Number(slide.dataset.pos) >= feedCount - 2) appendBatch();
    });
  }, { root: feed, threshold: [0.6] });

  function factIds() {
    return FACTS.map((f, i) => i).filter((i) => state.factFilter === "All" || FACTS[i].topic === state.factFilter);
  }

  function appendBatch() {
    let ids = shuffle(factIds());
    if (ids.length > 1 && ids[0] === lastBatchEnd) ids.push(ids.shift());
    ids.forEach((id) => {
      const slide = makeSlide(id, feedCount);
      feed.appendChild(slide);
      slideObserver.observe(slide);
      feedCount++;
    });
    lastBatchEnd = ids[ids.length - 1];
  }

  function buildFeed() {
    slideObserver.disconnect();
    feed.innerHTML = "";
    feedCount = 0; lastBatchEnd = -1;
    appendBatch();
    feed.scrollTop = 0;
  }

  function makeSlide(id, pos) {
    const f = FACTS[id];
    const t = TOPIC[f.topic];
    const color = t.color;
    const seen = state.seenFacts.has(id);
    const slide = el(`
      <div class="fact-slide" data-id="${id}" data-pos="${pos}">
        <article class="fact-card">
          <div class="fact-image" style="background: linear-gradient(150deg, ${shade(color, 0.25)}, ${color} 55%, ${shade(color, -0.18)})">
            <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
            <div class="fact-emoji" role="img" aria-label="${esc(f.topic)}">${f.emoji}</div>
          </div>
          <div class="fact-body">
            <span class="topic-tag" style="background:${color}">${t.emoji} ${esc(f.topic)}</span>
            <p class="fact-text">${esc(f.fact)}</p>
            <div class="fact-actions">
              <button class="btn-more" style="background:${color}">🔍 Tell me more</button>
              <span class="seen-badge">${seen ? "✓ Explored" : `+${POINTS_NEW_FACT} ⭐`}</span>
            </div>
            ${pos === 0 ? `<div class="swipe-hint">⬆️ Swipe up for the next fact</div>` : ""}
          </div>
        </article>
      </div>`);
    $(".btn-more", slide).onclick = () => openExplanation(id);
    return slide;
  }

  function openExplanation(id) {
    const f = FACTS[id];
    const t = TOPIC[f.topic];
    $("#sheet-body").innerHTML = `
      <div class="sheet-emoji">${f.emoji}</div>
      <span class="topic-tag" style="background:${t.color}">${t.emoji} ${esc(f.topic)}</span>
      <h3>${esc(f.fact)}</h3>
      <p>${esc(f.more)}</p>
      <button class="btn btn-primary btn-block" id="sheet-close">Got it! 👍</button>`;
    $("#sheet-close").onclick = closeSheet;
    $("#sheet-backdrop").classList.remove("hidden");
    requestAnimationFrame(() => $("#sheet").classList.add("open"));
    if (!state.explainedFacts.has(id)) {
      state.explainedFacts.add(id);
      addPoints(POINTS_EXPLAIN, "Curious mind!");
    }
  }
  function closeSheet() {
    $("#sheet").classList.remove("open");
    $("#sheet-backdrop").classList.add("hidden");
  }
  const sheetOpen = () => $("#sheet").classList.contains("open");
  $("#sheet-backdrop").onclick = closeSheet;

  // ================================================================ TOPIC MATCHING (keyword -> topic)
  function matchTopic(input) {
    const q = input.toLowerCase().trim().replace(/[^a-z0-9\s&-]/g, "");
    if (q.length < 2) return null;
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    let best = null, bestScore = 0;
    TOPICS.forEach((t) => {
      let s = 0;
      const name = t.name.toLowerCase();
      if (name === q || t.keywords.includes(q)) s += 100;
      if (name.includes(q) || q.includes(name)) s += 40;
      t.keywords.forEach((k) => {
        if (k.length >= 3 && (q.includes(k) || k.includes(q))) s += 20;
        words.forEach((w) => { if (k === w || (w.length > 3 && (k.startsWith(w) || w.startsWith(k)))) s += 10; });
      });
      // question text matches
      t.questions.forEach((qq) => {
        const text = qq.join(" ").toLowerCase();
        if (text.includes(q)) s += 4;
        else words.forEach((w) => { if (w.length > 3 && text.includes(w)) s += 1; });
      });
      if (s > bestScore) { bestScore = s; best = t; }
    });
    return bestScore >= 4 ? best : null;
  }

  // ================================================================ TRIVIA HUB
  function renderTrivia() {
    $("#trivia-rating").textContent = state.rating;
    $("#trivia-wl").textContent = `${state.wins} wins · ${state.losses} losses · ${state.draws} draws`;

    const mine = $("#my-challenges");
    mine.innerHTML = "";
    if (state.myChallenges.length) mine.appendChild(el(`<div class="muted small" style="margin:4px 2px 8px;font-weight:800">YOUR POSTED TOPICS</div>`));
    const mineList = el(`<div class="challenge-list" style="margin-bottom:16px"></div>`);
    state.myChallenges.forEach((c) => {
      const t = TOPIC[c.topic];
      const ready = !!c.opponent;
      const row = el(`
        <div class="challenge mine">
          <div class="ch-ic" style="background:${shade(t.color, 0.75)}">${t.emoji}</div>
          <div class="ch-main">
            <div class="ch-title">${esc(c.label)}</div>
            <div class="ch-meta">${ready ? `${c.opponent.avatar} ${esc(c.opponent.name)} joined!` : `<span class="dots">Waiting for a player</span>`}</div>
          </div>
          ${ready ? `<button class="btn btn-primary">Play</button>` : `<button class="btn btn-ghost">Cancel</button>`}
        </div>`);
      $(".btn", row).onclick = () => {
        if (ready) startMyChallenge(c);
        else { clearTimeout(c.timer); state.myChallenges = state.myChallenges.filter((x) => x !== c); renderTrivia(); }
      };
      mineList.appendChild(row);
    });
    if (state.myChallenges.length) mine.appendChild(mineList);

    const list = $("#global-list");
    list.innerHTML = "";
    if (!state.globalChallenges.length) list.appendChild(el(`<div class="empty">No open topics right now. Post one above!</div>`));
    state.globalChallenges.forEach((c) => {
      const t = TOPIC[c.topic];
      const row = el(`
        <div class="challenge">
          <div class="ch-ic" style="background:${shade(t.color, 0.75)}">${t.emoji}</div>
          <div class="ch-main">
            <div class="ch-title">${esc(c.label)}</div>
            <div class="ch-meta">${c.host.avatar} ${esc(c.host.name)} · ${c.mins}m ago · 20 Qs</div>
          </div>
          <button class="btn btn-violet">Join</button>
        </div>`);
      $(".btn", row).onclick = () => joinGlobal(c);
      list.appendChild(row);
    });
  }

  $("#post-form").onsubmit = (e) => {
    e.preventDefault();
    const input = $("#post-input");
    const text = input.value.trim();
    const hint = $("#post-hint");
    if (!text) { hint.textContent = "Type a topic first, like 'Planets' or 'Animals'."; return; }
    if (state.myChallenges.length >= 3) { hint.textContent = "You can have up to 3 topics waiting at a time."; return; }
    const topic = matchTopic(text);
    if (!topic) {
      hint.innerHTML = `Hmm, Knowky doesn't have questions about “${esc(text)}” yet. Try one of these:<br>`;
      TOPICS.forEach((t) => {
        const c = el(`<button type="button" class="chip">${t.emoji} ${esc(t.name)}</button>`);
        c.onclick = () => { input.value = t.name; hint.textContent = ""; input.focus(); };
        hint.appendChild(c);
      });
      return;
    }
    const ch = { id: Math.random().toString(36).slice(2), label: titleCase(text), topic: topic.name, opponent: null };
    state.myChallenges.unshift(ch);
    input.value = "";
    input.blur();
    hint.innerHTML = `Posted! Questions will come from <b>${topic.emoji} ${esc(topic.name)}</b>. Waiting for someone to join…`;
    ch.timer = setTimeout(() => {
      if (!state.myChallenges.includes(ch)) return;
      ch.opponent = makeBot();
      if (state.tab === "trivia") renderTrivia();
      if (!state.inMatch && !modalOpen()) {
        showModal({
          emoji: ch.opponent.avatar, title: `${ch.opponent.name} joined!`,
          text: `They want to battle you on “${ch.label}”. Ready?`,
          actions: [{ label: "Later" }, { label: "Play now", primary: true, onClick: () => startMyChallenge(ch) }],
        });
      } else toast(`${ch.opponent.name} joined your “${ch.label}” topic!`);
    }, rand(3500, 8000));
    renderTrivia();
  };

  function startMyChallenge(c) {
    state.myChallenges = state.myChallenges.filter((x) => x !== c);
    $("#post-hint").textContent = "";
    startMatch({ mode: "global", topic: c.topic, label: c.label, opponent: c.opponent });
  }

  function joinGlobal(c) {
    state.globalChallenges = state.globalChallenges.filter((x) => x !== c);
    renderTrivia();
    setTimeout(() => { state.globalChallenges.push(makeGlobalChallenge()); if (state.tab === "trivia") renderTrivia(); }, rand(5000, 10000));
    startMatch({ mode: "global", topic: c.topic, label: c.label, opponent: c.host });
  }

  $("#btn-random").onclick = () => startMatch({ mode: "random", topic: null, label: "Random Trivia" });
  $("#btn-solo").onclick = () => openSoloSetup();

  // ================================================================ SOLO SETUP
  let soloChoice = { topic: null, count: 10 };
  function openSoloSetup() {
    const ov = $("#overlay");
    ov.innerHTML = "";
    const v = el(`
      <div class="setup" style="display:flex;flex-direction:column;height:100%">
        <div class="ov-top"><button class="icon-btn" id="solo-close" aria-label="Close">✕</button><span class="info-pill">🧘 Solo Mode</span><span style="width:42px"></span></div>
        <div class="quiz-scroll">
          <h2>Pick a topic</h2>
          <div class="muted">Play on your own. No opponent, no pressure!</div>
          <div class="topic-grid" id="solo-topics"></div>
          <h2 style="font-size:20px">How many questions?</h2>
          <div class="seg" id="solo-count">
            <button data-n="10">10 · Quick</button><button data-n="20">20 · Full</button>
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="solo-start">Start ▶</button>
      </div>`);
    ov.appendChild(v);
    const grid = $("#solo-topics", v);
    const opts = [{ name: null, emoji: "🎲", label: "Mixed" }, ...TOPICS.map((t) => ({ name: t.name, emoji: t.emoji, label: t.name }))];
    const draw = () => {
      grid.innerHTML = "";
      opts.forEach((o) => {
        const b = el(`<button class="topic-btn ${soloChoice.topic === o.name ? "sel" : ""}"><span class="te">${o.emoji}</span>${esc(o.label)}</button>`);
        b.onclick = () => { soloChoice.topic = o.name; draw(); };
        grid.appendChild(b);
      });
      v.querySelectorAll("#solo-count button").forEach((b) => b.classList.toggle("sel", Number(b.dataset.n) === soloChoice.count));
    };
    v.querySelectorAll("#solo-count button").forEach((b) => (b.onclick = () => { soloChoice.count = Number(b.dataset.n); draw(); }));
    draw();
    $("#solo-close", v).onclick = closeOverlay;
    $("#solo-start", v).onclick = () => startMatch({ mode: "solo", topic: soloChoice.topic, label: soloChoice.topic || "Mixed topics", count: soloChoice.count });
    ov.classList.remove("hidden");
  }

  function closeOverlay() {
    const ov = $("#overlay");
    ov.classList.add("hidden");
    ov.innerHTML = "";
    state.inMatch = false;
    if (state.tab === "trivia") renderTrivia();
  }

  // ================================================================ MATCH ENGINE
  let match = null;

  function buildQuestions(topicName, count) {
    let pool;
    if (topicName) pool = TOPIC[topicName].questions.map((q) => ({ q, topic: topicName }));
    else pool = TOPICS.flatMap((t) => t.questions.map((q) => ({ q, topic: t.name })));
    return shuffle(pool).slice(0, count).map(({ q, topic }) => {
      const [text, correct, ...wrong] = q;
      const options = shuffle([correct, ...wrong]);
      return { text, options, correct: options.indexOf(correct), topic };
    });
  }

  function later(fn, ms) { const id = setTimeout(fn, ms); match && match.timeouts.push(id); return id; }
  function stopMatchTimers() {
    if (!match) return;
    match.timeouts.forEach(clearTimeout);
    clearInterval(match.tick);
    match.timeouts = [];
  }

  function startMatch({ mode, topic, label, opponent = null, count = QUESTIONS_PER_MATCH }) {
    closeModal(); closeSheet();
    stopMatchTimers();
    state.inMatch = true;
    match = {
      mode, topic, label, count,
      opponent: mode === "solo" ? null : opponent || null,
      questions: buildQuestions(topic, count),
      i: 0, you: 0, opp: 0,
      timeouts: [], tick: null, locked: false, finished: false,
    };
    const ov = $("#overlay");
    ov.classList.remove("hidden");
    if (mode === "random") showMatchmaking();
    else if (mode === "global") showVersus();
    else showCountdown();
  }

  function showMatchmaking() {
    const ov = $("#overlay");
    ov.innerHTML = `
      <div class="ov-top"><button class="icon-btn" id="mm-cancel" aria-label="Cancel">✕</button><span class="info-pill">🎲 Random Trivia</span><span style="width:42px"></span></div>
      <div class="ov-center">
        <div class="spinner"></div>
        <h2 style="margin:6px 0 0">Finding a player<span class="dots"></span></h2>
        <div class="muted">Mixed general knowledge · ${match.count} questions · ${SECONDS_PER_QUESTION}s each</div>
      </div>`;
    $("#mm-cancel").onclick = () => { stopMatchTimers(); match = null; closeOverlay(); };
    later(() => { match.opponent = makeBot(); showVersus(); }, rand(1800, 3600));
  }

  function showVersus() {
    const ov = $("#overlay");
    const o = match.opponent;
    const t = match.topic ? TOPIC[match.topic] : null;
    ov.innerHTML = `
      <div class="ov-center">
        <span class="info-pill">${t ? t.emoji : "🎲"} ${esc(match.label)}</span>
        <div class="vs-row">
          <div class="vs-player"><div class="vs-av" style="background:#FFE3D3">${state.avatar}</div><div class="vs-name">${esc(state.name)}</div></div>
          <div class="vs-badge">VS</div>
          <div class="vs-player"><div class="vs-av" style="background:#E8E4FF">${o.avatar}</div><div class="vs-name">${esc(o.name)}</div></div>
        </div>
        <div class="muted">${match.count} questions · ${SECONDS_PER_QUESTION} seconds each<br>Most correct answers wins!</div>
      </div>`;
    later(showCountdown, 2400);
  }

  function showCountdown() {
    const ov = $("#overlay");
    let n = 3;
    const draw = () => {
      ov.innerHTML = `<div class="ov-center"><div class="muted" style="font-weight:800">Get ready!</div><div class="big-num">${n}</div><div class="info-pill">${esc(match.label)}</div></div>`;
    };
    draw();
    const step = () => { n--; if (n > 0) { draw(); later(step, 800); } else showQuestion(); };
    later(step, 800);
  }

  function showQuestion() {
    const ov = $("#overlay");
    const q = match.questions[match.i];
    const o = match.opponent;
    match.locked = false;
    // decide the opponent's answer for this question in advance
    if (o) {
      match.botCorrect = Math.random() < o.skill;
      match.botTime = rand(3, 22);
      if (Math.random() < 0.06) match.botTime = SECONDS_PER_QUESTION + 1; // sometimes they run out of time
    }
    const letters = ["A", "B", "C", "D"];
    ov.innerHTML = `
      <div class="ov-top">
        <button class="icon-btn" id="q-quit" aria-label="Quit">✕</button>
        ${o ? `
        <div class="scorebar" style="flex:1">
          <div class="sb-player"><span class="sb-av">${state.avatar}</span><div class="sb-info"><div class="sb-name">You</div><div class="sb-score" id="sb-you">${match.you}</div><div class="sb-status">&nbsp;</div></div></div>
          <div class="timer" id="timer">${timerSvg()}<div class="timer-num" id="timer-num">${SECONDS_PER_QUESTION}</div></div>
          <div class="sb-player right"><span class="sb-av">${o.avatar}</span><div class="sb-info"><div class="sb-name">${esc(o.name)}</div><div class="sb-score" id="sb-opp">${match.opp}</div><div class="sb-status" id="sb-status">thinking…</div></div></div>
        </div>` : `
        <div style="flex:1;display:flex;justify-content:center"><span class="info-pill">🧘 Score: <b id="sb-you">${match.you}</b></span></div>
        <div class="timer" id="timer">${timerSvg()}<div class="timer-num" id="timer-num">${SECONDS_PER_QUESTION}</div></div>`}
      </div>
      <div class="q-progress"><span>Question ${match.i + 1} of ${match.count}</span><span>${TOPIC[q.topic].emoji} ${esc(q.topic)}</span></div>
      <div class="q-bar"><i style="width:${(match.i / match.count) * 100}%"></i></div>
      <div class="quiz-scroll">
        <div class="q-card"><div class="q-topic">${esc(match.label)}</div><p class="q-text">${esc(q.text)}</p></div>
        <div class="options">${q.options.map((op, k) => `<button class="opt" data-k="${k}"><span class="letter">${letters[k]}</span><span>${esc(op)}</span></button>`).join("")}</div>
        <div class="feedback" id="feedback"></div>
      </div>`;
    $("#q-quit").onclick = confirmQuit;
    ov.querySelectorAll(".opt").forEach((b) => (b.onclick = () => answer(Number(b.dataset.k))));

    const start = performance.now();
    const ring = ov.querySelector(".timer .ring");
    const C = 2 * Math.PI * 24;
    clearInterval(match.tick);
    match.tick = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const left = Math.max(0, SECONDS_PER_QUESTION - elapsed);
      const num = $("#timer-num");
      if (!num) return;
      num.textContent = Math.ceil(left);
      ring.style.strokeDashoffset = C * (1 - left / SECONDS_PER_QUESTION);
      const tm = $("#timer");
      tm.classList.toggle("warn", left <= 10 && left > 5);
      tm.classList.toggle("danger", left <= 5);
      if (o && elapsed >= match.botTime && !match.botShown) {
        match.botShown = true;
        const st = $("#sb-status"); if (st) { st.textContent = "answered ✓"; st.classList.add("done"); }
      }
      if (left <= 0) answer(null);
    }, 100);
    match.botShown = false;
  }

  function timerSvg() {
    const C = 2 * Math.PI * 24;
    return `<svg viewBox="0 0 58 58"><circle class="track" cx="29" cy="29" r="24" fill="none" stroke-width="7"/><circle class="ring" cx="29" cy="29" r="24" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>`;
  }

  function answer(k) {
    if (!match || match.locked) return;
    match.locked = true;
    clearInterval(match.tick);
    const q = match.questions[match.i];
    const ov = $("#overlay");
    const buttons = ov.querySelectorAll(".opt");
    buttons.forEach((b) => (b.disabled = true));
    const right = k === q.correct;
    if (right) match.you++;
    buttons.forEach((b, idx) => {
      if (idx === q.correct) b.classList.add("correct");
      else if (idx === k) b.classList.add("wrong");
      else b.classList.add("dim");
    });
    const fb = $("#feedback");
    let msg = k === null ? `⏰ Time's up! The answer is “${q.options[q.correct]}”.` : right ? pick(["Correct! 🎉", "Brilliant! 🌟", "You got it! ✅", "Super smart! 🧠"]) : `Oops! The answer is “${q.options[q.correct]}”.`;
    fb.className = "feedback " + (right ? "good" : "bad");

    const o = match.opponent;
    if (o) {
      const botAnswered = match.botTime <= SECONDS_PER_QUESTION;
      const botRight = botAnswered && match.botCorrect;
      if (botRight) match.opp++;
      const st = $("#sb-status");
      if (st) { st.textContent = !botAnswered ? "ran out of time" : botRight ? "got it right ✓" : "got it wrong ✗"; st.classList.toggle("done", botRight); }
      msg += `<br><span class="muted small">${esc(o.name)} ${!botAnswered ? "ran out of time" : botRight ? "got it right" : "got it wrong"}</span>`;
      $("#sb-opp").textContent = match.opp;
    }
    $("#sb-you").textContent = match.you;
    fb.innerHTML = msg;

    later(() => {
      match.i++;
      if (match.i >= match.count) finishMatch();
      else showQuestion();
    }, right ? 1500 : 2300);
  }

  function confirmQuit() {
    const competitive = !!match.opponent;
    showModal({
      emoji: "🚪", title: "Leave the quiz?",
      text: competitive ? "If you leave now it counts as a loss." : "Your answers in this quiz won't count.",
      actions: [{ label: "Keep playing", primary: true }, { label: "Leave", onClick: () => quitMatch() }],
    });
  }

  function quitMatch() {
    if (!match) return;
    stopMatchTimers();
    if (match.opponent && !match.finished) {
      record({ result: "loss", delta: applyRating(RATING_LOSS), quit: true });
    }
    match = null;
    closeOverlay();
  }

  function applyRating(delta) {
    const before = state.rating;
    state.rating = Math.max(0, state.rating + delta);
    updateHeader();
    return state.rating - before;
  }

  function record({ result, delta, quit = false }) {
    state.played++;
    if (result === "win") state.wins++;
    else if (result === "loss") state.losses++;
    else if (result === "draw") state.draws++;
    state.history.unshift({
      mode: match.mode, label: match.label, you: match.you, opp: match.opp, total: match.count,
      oppName: match.opponent ? match.opponent.name : null, result, delta, quit,
    });
    state.history = state.history.slice(0, 15);
  }

  function finishMatch() {
    stopMatchTimers();
    match.finished = true;
    const ov = $("#overlay");
    const m = match;
    let html;
    if (m.opponent) {
      const result = m.you > m.opp ? "win" : m.you < m.opp ? "loss" : "draw";
      const delta = applyRating(result === "win" ? RATING_WIN : result === "loss" ? RATING_LOSS : RATING_DRAW);
      record({ result, delta });
      const head = { win: ["🏆", "You won!"], loss: ["💪", "Nice try!"], draw: ["🤝", "It's a draw!"] }[result];
      html = `
        <div class="ov-center">
          <div class="result-emoji">${head[0]}</div>
          <h1 class="result-title">${head[1]}</h1>
          <div class="muted">${esc(m.label)}</div>
          <div class="result-score">
            <div class="rs-box ${result === "win" ? "win" : ""}"><div>${state.avatar} You</div><div class="big">${m.you}/${m.count}</div></div>
            <div class="rs-box ${result === "loss" ? "win" : ""}"><div>${m.opponent.avatar} ${esc(m.opponent.name)}</div><div class="big">${m.opp}/${m.count}</div></div>
          </div>
          <div class="delta ${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}">🏆 Rating ${delta > 0 ? "+" : ""}${delta} → ${state.rating}</div>
          ${result === "loss" ? `<div class="muted small">Explore more facts to get even smarter!</div>` : ""}
        </div>`;
      if (result === "win") confetti();
    } else {
      record({ result: "solo", delta: 0 });
      const pct = m.you / m.count;
      const prev = state.soloBest;
      const isBest = !prev || pct > prev.score / prev.total;
      if (isBest) state.soloBest = { score: m.you, total: m.count };
      const head = pct >= 0.9 ? ["🌟", "Superstar!"] : pct >= 0.7 ? ["🎉", "Great job!"] : pct >= 0.4 ? ["👍", "Good effort!"] : ["🌱", "Keep learning!"];
      html = `
        <div class="ov-center">
          <div class="result-emoji">${head[0]}</div>
          <h1 class="result-title">${head[1]}</h1>
          <div class="muted">Solo · ${esc(m.label)}</div>
          <div class="result-score"><div class="rs-box win"><div>Your score</div><div class="big">${m.you}/${m.count}</div></div></div>
          <div class="delta ${isBest ? "up" : "flat"}">${isBest ? "🎯 New personal best!" : `Best: ${prev.score}/${prev.total}`}</div>
        </div>`;
      if (pct >= 0.7) confetti();
    }
    ov.innerHTML = `${html}
      <div class="result-actions">
        ${m.mode === "global" ? `<button class="btn btn-primary btn-block" id="r-again">🌐 Find another topic</button>` : `<button class="btn btn-primary btn-block" id="r-again">🔁 Play again</button>`}
        <button class="btn btn-ghost btn-block" id="r-home">Back to Trivia</button>
      </div>`;
    $("#r-home").onclick = () => { match = null; closeOverlay(); switchTab("trivia"); };
    $("#r-again").onclick = () => {
      const again = { mode: m.mode, topic: m.topic, label: m.label, count: m.count };
      if (m.mode === "global") { match = null; closeOverlay(); switchTab("trivia"); return; }
      startMatch(again);
    };
    updateHeader();
  }

  // ================================================================ PROFILE
  function renderProfile() {
    $("#profile-avatar").textContent = state.avatar;
    $("#profile-name").value = state.name;
    $("#st-points").textContent = state.points;
    $("#st-facts").textContent = `${state.seenFacts.size}/${FACTS.length}`;
    $("#st-rating").textContent = state.rating;
    $("#st-record").textContent = `${state.wins}-${state.losses}-${state.draws}`;
    $("#st-solo").textContent = state.soloBest ? `${state.soloBest.score}/${state.soloBest.total}` : "–";
    $("#st-played").textContent = state.played;

    const h = $("#history");
    h.innerHTML = "";
    if (!state.history.length) { h.appendChild(el(`<div class="empty">No games yet. Head to Trivia and play your first quiz! 🧠</div>`)); return; }
    const badge = { win: ["WIN", "#22B573"], loss: ["LOSS", "#F0506E"], draw: ["DRAW", "#8E86A8"], solo: ["SOLO", "#1FA2D6"] };
    state.history.forEach((g) => {
      const [txt, col] = badge[g.result];
      const sub = g.quit ? "Left the match" : g.oppName ? `You ${g.you} – ${g.opp} ${esc(g.oppName)}` : `Scored ${g.you}/${g.total}`;
      h.appendChild(el(`
        <div class="hist">
          <span class="hist-badge" style="background:${col}">${txt}</span>
          <div class="hist-main"><b>${esc(g.label)}</b><span class="muted">${sub}</span></div>
          ${g.result !== "solo" ? `<span class="hist-delta" style="color:${g.delta >= 0 ? "#158a55" : "#c2304f"}">${g.delta > 0 ? "+" : ""}${g.delta}</span>` : ""}
        </div>`));
    });
  }

  const picker = $("#avatar-picker");
  AVATARS.forEach((a) => {
    const b = el(`<button>${a}</button>`);
    b.onclick = () => { state.avatar = a; picker.classList.add("hidden"); renderProfile(); };
    picker.appendChild(b);
  });
  $("#profile-avatar").onclick = () => {
    picker.querySelectorAll("button").forEach((b) => b.classList.toggle("sel", b.textContent === state.avatar));
    picker.classList.toggle("hidden");
  };
  $("#profile-name").addEventListener("input", (e) => { state.name = e.target.value.trim() || "Explorer"; });
  $("#profile-name").addEventListener("blur", (e) => { e.target.value = state.name; });

  // ================================================================ ANDROID BACK BUTTON
  function handleBack() {
    if (modalOpen()) { closeModal(); return; }
    if (sheetOpen()) { closeSheet(); return; }
    if (!$("#avatar-picker").classList.contains("hidden")) { $("#avatar-picker").classList.add("hidden"); return; }
    if (!$("#overlay").classList.contains("hidden")) {
      if (match && !match.finished && match.questions && $("#q-quit")) { confirmQuit(); return; }
      if (match && !match.finished) { stopMatchTimers(); match = null; }
      closeOverlay(); return;
    }
    if (state.tab !== "facts") { switchTab("facts"); return; }
    showModal({
      emoji: "👋", title: "Leave Knowky?", text: "Your points will reset because Knowky doesn't save anything.",
      actions: [{ label: "Stay", primary: true }, { label: "Exit", onClick: () => window.capacitorApp && window.capacitorApp.App.exitApp() }],
    });
  }
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.capacitorApp) {
      window.capacitorApp.App.addListener("backButton", handleBack);
    }
  } catch (e) { /* running in a normal browser */ }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") handleBack(); });

  // ================================================================ INIT
  for (let i = 0; i < 6; i++) state.globalChallenges.push(makeGlobalChallenge());
  setInterval(() => {
    if (state.globalChallenges.length < 8) {
      state.globalChallenges.unshift(makeGlobalChallenge());
      if (state.tab === "trivia" && !state.inMatch) renderTrivia();
    }
    state.globalChallenges.forEach((c) => (c.mins += 1));
  }, 30000);

  renderFilters();
  buildFeed();
  updateHeader();
})();
