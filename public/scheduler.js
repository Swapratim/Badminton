/* =========================================================================
   IFD Badminton Match Scheduler — scheduling engine (pure, DOM-free)
   Works in the browser (window.Scheduler) and in Node (module.exports)
   so the algorithm can be unit-tested headlessly.

   A player: { id, name, level: "L1".."L4", woman: bool }
   Options:  { courts, rounds, maxGap, mensRounds, womensRounds, strongDir }
   ========================================================================= */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Scheduler = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = ["L1", "L2", "L3", "L4"];
  const lvlNum = (l) => LEVELS.indexOf(l) + 1;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const pairKey = (a, b) => [a.id, b.id].sort((x, y) => x - y).join("-");
  const matchKey = (t1, t2) => {
    const k1 = t1.map(p => p.id).sort((a, b) => a - b).join("-");
    const k2 = t2.map(p => p.id).sort((a, b) => a - b).join("-");
    return [k1, k2].sort().join("|");
  };

  function makeSkill(strongDir) {
    return (p) => strongDir === "low" ? (5 - lvlNum(p.level)) : lvlNum(p.level);
  }

  function matchType(match) {
    const all = [...match[0], ...match[1]];
    const women = all.filter(p => p.woman).length;
    if (women === 0) return "mens";
    if (women === all.length) return "womens";
    return "mixed";
  }

  /* ---- plan a target type per round (rules D, E) ---- */
  function planRoundTypes(players, rounds, opt) {
    const women = players.filter(p => p.woman);
    const men = players.filter(p => !p.woman);
    const womenPct = players.length ? women.length / players.length : 0;

    let mens = clamp(opt.mensRounds, 0, rounds);
    let womens = clamp(opt.womensRounds, 0, rounds);
    if (men.length < 4) mens = 0;
    if (women.length < 4) womens = 0;
    // Rule E: auto women's doubles only when women > 40% (unless user forced a value)
    if (womenPct <= 0.40 && !opt.womensForced) womens = 0;
    mens = Math.min(mens, Math.max(0, rounds - womens));

    const types = new Array(rounds).fill("mixed");
    const special = [];
    for (let i = 0; i < mens; i++) special.push("mens");
    for (let i = 0; i < womens; i++) special.push("womens");
    if (special.length) {
      const step = rounds / (special.length + 1);
      special.forEach((t, i) => {
        let pos = Math.max(0, Math.min(rounds - 1, Math.round(step * (i + 1)) - 1));
        while (types[pos] !== "mixed" && pos < rounds - 1) pos++;
        while (types[pos] !== "mixed" && pos > 0) pos--;
        types[pos] = t;
      });
    }
    return types;
  }
  const clamp = (v, min, max) => Math.max(min, Math.min(max, isNaN(v) ? 0 : v));

  /* ---- fair rest selection (rule F) ---- */
  function chooseResters(players, restNeeded, restCount, lastRest) {
    if (restNeeded <= 0) return [];
    const pool = shuffle(players);
    pool.sort((a, b) => {
      const aLast = lastRest.has(a.id) ? 1 : 0;
      const bLast = lastRest.has(b.id) ? 1 : 0;
      if (aLast !== bLast) return aLast - bLast;
      return (restCount[a.id] || 0) - (restCount[b.id] || 0);
    });
    return pool.slice(0, restNeeded);
  }

  /* ---- team formation (rules B, D, H) ---- */
  function makeTeams(active, type, ctx, relax, skill) {
    const remaining = shuffle(active);
    const teams = [];
    const wantOpposite = type === "mixed";
    while (remaining.length) {
      const a = remaining.shift();
      let best = -1, bestScore = Infinity;
      for (let j = 0; j < remaining.length; j++) {
        const b = remaining[j];
        if (relax < 1 && ctx.partnerUsed.has(pairKey(a, b))) continue;
        const opposite = a.woman !== b.woman;
        if (relax < 1) {
          if (type === "mens" && (a.woman || b.woman)) continue;
          if (type === "womens" && (!a.woman || !b.woman)) continue;
        }
        let s = 0;
        if (wantOpposite && !opposite) s += 6;
        if (!wantOpposite && opposite && relax < 1) s += 8;
        s += Math.abs(skill(a) - skill(b)) * 0.5;
        if (ctx.lastPartner[a.id] === b.id) s += 5;
        s += Math.random() * 1.5;
        if (s < bestScore) { bestScore = s; best = j; }
      }
      // best === -1 only happens at relax 0 (all partners filtered out).
      // Return null so buildRound escalates the relaxation tier (rule I) and
      // the round is honestly badged as relaxed, rather than silently forcing.
      if (best === -1) return null;
      const partner = remaining.splice(best, 1)[0];
      teams.push([a, partner]);
    }
    return teams;
  }

  /* ---- match formation (rules C, G, H, I) ---- */
  function makeMatches(teams, ctx, maxGap, relax, skill) {
    const remaining = shuffle(teams);
    const matches = [];
    while (remaining.length >= 2) {
      const t1 = remaining.shift();
      let best = -1, bestScore = Infinity;
      for (let j = 0; j < remaining.length; j++) {
        const t2 = remaining[j];
        const four = [...t1, ...t2];
        const levels = four.map(p => lvlNum(p.level));
        const spread = Math.max(...levels) - Math.min(...levels);
        if (relax < 2 && spread > maxGap) continue;
        if (relax < 1 && ctx.matchupUsed.has(matchKey(t1, t2))) continue;
        const s1 = t1.reduce((x, p) => x + skill(p), 0);
        const s2 = t2.reduce((x, p) => x + skill(p), 0);
        let s = Math.abs(s1 - s2) * 2;
        s += spread * 0.6;
        const gap1 = Math.abs(skill(t1[0]) - skill(t1[1]));
        const gap2 = Math.abs(skill(t2[0]) - skill(t2[1]));
        s += Math.abs(gap1 - gap2) * 1.5;
        s += Math.random();
        if (s < bestScore) { bestScore = s; best = j; }
      }
      if (best === -1) {
        if (relax < 2) return null;
        best = 0;
      }
      const t2 = remaining.splice(best, 1)[0];
      matches.push([t1, t2]);
    }
    return matches;
  }

  function scoreRound(matches, targetType, ctx, skill) {
    let s = 0;
    for (const m of matches) {
      const all = [...m[0], ...m[1]];
      const levels = all.map(p => lvlNum(p.level));
      s += (Math.max(...levels) - Math.min(...levels)) * 1.2;
      const s1 = m[0].reduce((x, p) => x + skill(p), 0);
      const s2 = m[1].reduce((x, p) => x + skill(p), 0);
      s += Math.abs(s1 - s2) * 2;
      if (matchType(m) !== targetType) s += 4;
      for (const t of m) {
        if (ctx.partnerUsed.has(pairKey(t[0], t[1]))) s += 6;
        if (ctx.lastPartner[t[0].id] === t[1].id) s += 4;
      }
    }
    return s;
  }

  function buildRound(active, courts, type, ctx, maxGap, skill, attempts) {
    const ATTEMPTS = attempts || 600;
    for (let relax = 0; relax <= 2; relax++) {
      let best = null, bestScore = Infinity;
      for (let a = 0; a < ATTEMPTS; a++) {
        const teams = makeTeams(active, type, ctx, relax, skill);
        if (!teams) continue;
        const matches = makeMatches(teams, ctx, maxGap, relax, skill);
        if (!matches) continue;
        const score = scoreRound(matches, type, ctx, skill);
        if (score < bestScore) { bestScore = score; best = matches; }
      }
      if (best) return { matches: best, relaxed: relax };
    }
    return null;
  }

  /* ---- full schedule ---- */
  function generate(players, opt) {
    const skill = makeSkill(opt.strongDir || "high");
    const courts = opt.courts, rounds = opt.rounds, maxGap = opt.maxGap;
    const ctx = {
      partnerUsed: new Set(), matchupUsed: new Set(),
      lastPartner: {}, restCount: {}, lastRest: new Set(),
    };
    const types = planRoundTypes(players, rounds, opt);
    const schedule = [];
    const slots = courts * 4;

    for (let r = 0; r < rounds; r++) {
      const restNeeded = Math.max(0, players.length - slots);
      const resters = chooseResters(players, restNeeded, ctx.restCount, ctx.lastRest);
      const restIds = new Set(resters.map(p => p.id));
      let active = players.filter(p => !restIds.has(p.id));
      const playing = Math.min(courts, Math.floor(active.length / 4)) * 4;
      const benched = active.slice(playing);
      active = active.slice(0, playing);

      const round = buildRound(active, courts, types[r], ctx, maxGap, skill, opt.attempts);
      const allResters = [...resters, ...benched];

      ctx.lastRest = new Set(allResters.map(p => p.id));
      allResters.forEach(p => { ctx.restCount[p.id] = (ctx.restCount[p.id] || 0) + 1; });
      const newLastPartner = {};
      if (round) {
        for (const m of round.matches) {
          for (const t of m) {
            ctx.partnerUsed.add(pairKey(t[0], t[1]));
            newLastPartner[t[0].id] = t[1].id;
            newLastPartner[t[1].id] = t[0].id;
          }
          ctx.matchupUsed.add(matchKey(m[0], m[1]));
        }
      }
      ctx.lastPartner = newLastPartner;

      schedule.push({
        round: r + 1,
        plannedType: types[r],
        matches: round ? round.matches : [],
        relaxed: round ? round.relaxed : 0,
        rest: allResters,
      });
    }
    return schedule;
  }

  return { generate, matchType, LEVELS, lvlNum, _internals: { planRoundTypes, makeSkill } };
});
