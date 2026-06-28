/* =========================================================================
   IFD Badminton Match Scheduler — UI layer
   Reads inputs, calls the (DOM-free) Scheduler engine, renders, shares.
   Pure client-side. No login, no storage. Refresh clears everything.
   ========================================================================= */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LEVELS = Scheduler.LEVELS;
  const lvlNum = Scheduler.lvlNum;
  const matchType = Scheduler.matchType;

  const state = { customRules: [], last: null };

  const SAMPLE = ["Arjun","Riya","Sam","Neha","Vikram","Priya","Karan","Anita",
    "Rahul","Meera","Dev","Sara","Aman","Tara","Rohit","Isha","Nikhil","Pooja",
    "Varun","Divya","Kabir","Lina","Yash","Gauri"];

  const clampInt = (v, min, max, def) => {
    let n = parseInt(v, 10);
    if (isNaN(n)) n = def;
    return Math.max(min, Math.min(max, n));
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- player rows ---------------- */
  function buildPlayerRows() {
    const n = clampInt($("numPlayers").value, 4, 60, 12);
    const list = $("playerList");
    const existing = readPlayers();
    list.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const prev = existing[i] || {};
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `
        <span class="idx">${i + 1}</span>
        <input type="text" class="p-name" placeholder="Player ${i + 1}" value="${esc(prev.name || "")}" />
        <select class="p-level">
          ${LEVELS.map(l => `<option value="${l}" ${prev.level === l ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <span class="gender-toggle">
          <input type="checkbox" class="p-woman" ${prev.woman ? "checked" : ""} title="Tick if the player is a woman" />
        </span>`;
      list.appendChild(row);
    }
    updateBalanceBar();
  }

  function readPlayers() {
    return [...document.querySelectorAll(".player-row")].map((r, i) => ({
      id: i,
      name: r.querySelector(".p-name").value.trim(),
      level: r.querySelector(".p-level").value,
      woman: r.querySelector(".p-woman").checked,
    }));
  }

  function updateBalanceBar() {
    const named = readPlayers().filter(p => p.name);
    const women = named.filter(p => p.woman).length;
    const men = named.length - women;
    const pct = named.length ? Math.round((women / named.length) * 100) : 0;
    const byLvl = LEVELS.map(l => `${l}:${named.filter(p => p.level === l).length}`).join("  ");
    const warn = pct > 40 ? "warn" : "";
    $("balanceBar").innerHTML = `
      <span class="pill">👥 ${named.length} named</span>
      <span class="pill">♂ ${men}</span>
      <span class="pill ${warn}">♀ ${women} (${pct}%)</span>
      <span class="pill">${byLvl}</span>
      ${pct > 40 ? '<span class="pill warn">women &gt; 40% → women\'s doubles enabled</span>' : ""}`;
  }

  /* ---------------- render ---------------- */
  function teamHtml(team) {
    return team.map(p =>
      `<span>${esc(p.name)}<span class="lvl"> ·${p.level}${p.woman ? '<span class="w"> ♀</span>' : ''}</span></span>`
    ).join(" &amp; ");
  }

  function renderSchedule(schedule, meta) {
    const host = $("scheduleTables");
    host.innerHTML = "";
    schedule.forEach(rnd => {
      const block = document.createElement("div");
      block.className = "round-block";
      const rows = rnd.matches.map((m, i) => {
        const mt = matchType(m);
        return `<tr>
          <td class="court-col">${i + 1}</td>
          <td class="team">${teamHtml(m[0])}</td>
          <td class="vs">vs</td>
          <td class="team">${teamHtml(m[1])}</td>
          <td><span class="mtag ${mt}">${mt === "mens" ? "Men's" : mt === "womens" ? "Women's" : "Mixed"}</span></td>
        </tr>`;
      }).join("");
      const restTxt = rnd.rest.length
        ? `<div class="rest-line">🪑 <b>Resting:</b> ${rnd.rest.map(p => esc(p.name)).join(", ")}</div>` : "";
      const relaxNote = rnd.relaxed >= 2
        ? ' <span class="tag" title="Level gap relaxed to fill the schedule (rule I)">↯ levels relaxed</span>'
        : rnd.relaxed >= 1
        ? ' <span class="tag" title="Repeat pairing allowed to fill the schedule (rule I)">↯ repeat allowed</span>' : "";
      block.innerHTML = `
        <h3 class="round-title">Round ${rnd.round}
          <span class="tag ${rnd.plannedType}">${rnd.plannedType === "mens" ? "Men's focus" : rnd.plannedType === "womens" ? "Women's focus" : "Mixed"}</span>${relaxNote}
        </h3>
        <table class="sched">
          <thead><tr><th>Court</th><th>Team A</th><th></th><th>Team B</th><th>Type</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">No match could be formed.</td></tr>'}</tbody>
        </table>
        ${restTxt}`;
      host.appendChild(block);
    });

    $("printMeta").textContent = meta;
    const counts = {};
    schedule.forEach(r => r.rest.forEach(p => { counts[p.name] = (counts[p.name] || 0) + 1; }));
    const restEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    $("restSummary").innerHTML = restEntries.length
      ? `<div class="rest-line"><b>Rest tally:</b> ${restEntries.map(([n, c]) => `${esc(n)} ×${c}`).join(" · ")}</div>` : "";
    $("printNotes").innerHTML = state.customRules.length
      ? `<b>Session notes:</b><ul>${state.customRules.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : "";

    $("output").hidden = false;
    $("tuneCard").hidden = false;
  }

  /* ---------------- share / print text ---------------- */
  function scheduleToText(schedule, meta) {
    const lines = ["🏸 IFD Badminton Match Scheduler", meta, ""];
    schedule.forEach(rnd => {
      lines.push(`*Round ${rnd.round}*`);
      rnd.matches.forEach((m, i) => {
        const names = (t) => t.map(p => `${p.name}(${p.level})`).join(" & ");
        const mt = matchType(m);
        const tag = mt === "mens" ? "M" : mt === "womens" ? "W" : "X";
        lines.push(`  C${i + 1} [${tag}] ${names(m[0])}  vs  ${names(m[1])}`);
      });
      if (rnd.rest.length) lines.push(`  Rest: ${rnd.rest.map(p => p.name).join(", ")}`);
      lines.push("");
    });
    if (state.customRules.length) {
      lines.push("Notes:");
      state.customRules.forEach(r => lines.push(`- ${r}`));
    }
    return lines.join("\n");
  }

  /* ---------------- main ---------------- */
  function run() {
    $("errMsg").textContent = "";
    const players = readPlayers();
    if (players.filter(p => p.name).length < 4) {
      $("errMsg").textContent = "Add at least 4 named players to build a roaster.";
      return;
    }
    players.forEach((p, i) => { if (!p.name) p.name = `Player ${i + 1}`; });

    const opt = {
      courts: clampInt($("numCourts").value, 1, 15, 3),
      rounds: clampInt($("numRounds").value, 1, 40, 10),
      maxGap: parseInt($("maxGap").value, 10),
      mensRounds: clampInt($("mensRounds").value, 0, 10, 2),
      womensRounds: clampInt($("womensRounds").value, 0, 10, 0),
      womensForced: $("womensRounds").value !== "" && parseInt($("womensRounds").value, 10) > 0,
      strongDir: $("strongDir").value,
    };

    const schedule = Scheduler.generate(players, opt);
    const meta = `${players.length} players · ${opt.courts} court${opt.courts > 1 ? "s" : ""} · ${opt.rounds} rounds · ~${$("duration").value} hr · ${new Date().toLocaleDateString()}`;
    state.last = { schedule, meta };
    renderSchedule(schedule, meta);
    $("output").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function renderCustomRules() {
    const ul = $("customRuleList");
    ul.innerHTML = state.customRules.map((r, i) =>
      `<li><span>${esc(r)}</span><button data-i="${i}" title="Remove">✕</button></li>`).join("");
    ul.querySelectorAll("button").forEach(b =>
      b.addEventListener("click", () => {
        state.customRules.splice(+b.dataset.i, 1);
        renderCustomRules();
        if (state.last) renderSchedule(state.last.schedule, state.last.meta);
      }));
  }

  /* ---------------- wire up ---------------- */
  function init() {
    buildPlayerRows();
    $("numPlayers").addEventListener("change", buildPlayerRows);
    $("playerList").addEventListener("input", updateBalanceBar);
    $("playerList").addEventListener("change", updateBalanceBar);

    $("duration").addEventListener("input", () => {
      const h = parseFloat($("duration").value) || 0;
      $("numRounds").value = Math.max(1, Math.round(h * 5));   // rule A
    });

    $("fillSample").addEventListener("click", () => {
      [...document.querySelectorAll(".player-row")].forEach((r, i) => {
        r.querySelector(".p-name").value = SAMPLE[i % SAMPLE.length] + (i >= SAMPLE.length ? " " + (i + 1) : "");
        r.querySelector(".p-level").value = LEVELS[i % 4];
        r.querySelector(".p-woman").checked = i % 3 === 1;
      });
      updateBalanceBar();
    });
    $("clearNames").addEventListener("click", () => {
      document.querySelectorAll(".p-name").forEach(i => i.value = "");
      updateBalanceBar();
    });

    $("generate").addEventListener("click", run);
    $("rebuild").addEventListener("click", run);

    $("addRule").addEventListener("click", () => {
      const v = $("customRuleInput").value.trim();
      if (!v) return;
      state.customRules.push(v);
      $("customRuleInput").value = "";
      renderCustomRules();
      if (state.last) renderSchedule(state.last.schedule, state.last.meta);
    });
    $("customRuleInput").addEventListener("keydown", e => { if (e.key === "Enter") $("addRule").click(); });

    $("printBtn").addEventListener("click", () => window.print());
    $("shareWa").addEventListener("click", () => {
      if (!state.last) return;
      window.open("https://wa.me/?text=" + encodeURIComponent(scheduleToText(state.last.schedule, state.last.meta)), "_blank");
    });
    $("copyText").addEventListener("click", async () => {
      if (!state.last) return;
      try { await navigator.clipboard.writeText(scheduleToText(state.last.schedule, state.last.meta)); toast("Schedule copied ✓"); }
      catch { toast("Copy failed — long-press to select"); }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
