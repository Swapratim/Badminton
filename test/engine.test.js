/* Headless validation of the scheduling engine against rules A–I. */
const S = require("../public/scheduler.js");
const LEVELS = S.LEVELS;
const lvlNum = S.lvlNum;

function mkPlayers(n, womenPct, levelDist) {
  const players = [];
  for (let i = 0; i < n; i++) {
    const woman = i < Math.round(n * womenPct);
    const level = levelDist ? levelDist(i, n) : LEVELS[i % 4];
    players.push({ id: i, name: "P" + i, level, woman });
  }
  // shuffle gender/level assignment a bit so women aren't all first
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tw = players[i].woman; players[i].woman = players[j].woman; players[j].woman = tw;
  }
  return players;
}

const pk = (a, b) => [a.id, b.id].sort((x, y) => x - y).join("-");

function check(name, players, opt) {
  const sched = S.generate(players, opt);
  const issues = [];
  const partnerSeen = new Map();   // pairKey -> count
  let prevRest = null;
  const restCount = {};
  const playerActiveRounds = {};

  sched.forEach((rnd, ri) => {
    const playingIds = new Set();
    rnd.matches.forEach(m => {
      const four = [...m[0], ...m[1]];
      four.forEach(p => { playingIds.add(p.id); playerActiveRounds[p.id] = (playerActiveRounds[p.id] || 0) + 1; });
      // unique players within a match
      if (new Set(four.map(p => p.id)).size !== 4) issues.push(`R${rnd.round}: duplicate player in a match`);
      // rule C (unless relaxed to level 2)
      const levels = four.map(p => lvlNum(p.level));
      const spread = Math.max(...levels) - Math.min(...levels);
      if (rnd.relaxed < 2 && spread > opt.maxGap) issues.push(`R${rnd.round}: level spread ${spread} > ${opt.maxGap} (relaxed=${rnd.relaxed})`);
      // rule H: partnership uniqueness (count repeats only when not relaxed)
      m.forEach(t => {
        const k = pk(t[0], t[1]);
        partnerSeen.set(k, (partnerSeen.get(k) || 0) + 1);
      });
    });
    // resters didn't also play
    rnd.rest.forEach(p => {
      if (playingIds.has(p.id)) issues.push(`R${rnd.round}: ${p.name} both rests and plays`);
      restCount[p.id] = (restCount[p.id] || 0) + 1;
    });
    // rule F: no back-to-back rest (only enforce when there's slack to avoid it)
    if (prevRest) {
      const restIds = new Set(rnd.rest.map(p => p.id));
      const both = [...prevRest].filter(id => restIds.has(id));
      const slack = players.length - rnd.rest.length; // active count; if > rest needs, avoidable
      if (both.length && players.length - opt.courts * 4 > 0 && (players.length - (opt.courts*4)) * 2 <= players.length) {
        // avoidable only when total players >= 2*restNeeded; flag softly
        issues.push(`R${rnd.round}: back-to-back rest for ids ${both.join(",")} (soft)`);
      }
    }
    prevRest = new Set(rnd.rest.map(p => p.id));
  });

  // partnership repeats
  let repeats = 0;
  partnerSeen.forEach(c => { if (c > 1) repeats += (c - 1); });

  // rest fairness spread
  const rc = Object.values(restCount);
  const restSpread = rc.length ? Math.max(...rc) - Math.min(...rc) : 0;

  // type distribution
  const typeCount = { mixed: 0, mens: 0, womens: 0 };
  sched.forEach(r => r.matches.forEach(m => typeCount[S.matchType(m)]++));

  const hard = issues.filter(i => !i.includes("(soft)"));
  const soft = issues.filter(i => i.includes("(soft)"));
  console.log(`\n=== ${name} ===`);
  console.log(`  players=${players.length} courts=${opt.courts} rounds=${opt.rounds} maxGap=${opt.maxGap}`);
  console.log(`  match types: mixed=${typeCount.mixed} mens=${typeCount.mens} womens=${typeCount.womens}`);
  console.log(`  partnership repeats: ${repeats}`);
  console.log(`  rest spread (max-min): ${restSpread}  (counts: ${JSON.stringify(restCount)})`);
  console.log(`  relaxed rounds: ${sched.filter(r => r.relaxed > 0).map(r => `R${r.round}:${r.relaxed}`).join(" ") || "none"}`);
  console.log(`  HARD issues: ${hard.length}`);
  hard.slice(0, 8).forEach(i => console.log("    ✗ " + i));
  console.log(`  soft (back-to-back rest) notes: ${soft.length}`);
  return { hard: hard.length, soft: soft.length, repeats, restSpread, typeCount };
}

const baseOpt = { courts: 3, rounds: 10, maxGap: 2, mensRounds: 1, womensRounds: 0, strongDir: "high", attempts: 600 };
let totalHard = 0;

// Scenario 1: 12 players, 3 courts, even fit, ~33% women
totalHard += check("12p/3c even, 33% women", mkPlayers(12, 0.33), { ...baseOpt }).hard;
// Scenario 2: 13 players, 3 courts -> 1 rests each round
totalHard += check("13p/3c, one rests", mkPlayers(13, 0.30), { ...baseOpt }).hard;
// Scenario 3: 16 players, 4 courts, 50% women -> women's doubles auto
totalHard += check("16p/4c, 50% women", mkPlayers(16, 0.50), { ...baseOpt, courts: 4, womensRounds: 1, mensRounds: 1 }).hard;
// Scenario 4: 8 players, 2 courts, all same level
totalHard += check("8p/2c all L2", mkPlayers(8, 0.25, () => "L2"), { ...baseOpt, courts: 2 }).hard;
// Scenario 5: small pool, many rounds -> forces relaxation (rule I)
totalHard += check("8p/2c, 12 rounds (exhaustion)", mkPlayers(8, 0.5), { ...baseOpt, courts: 2, rounds: 12, womensRounds: 1 }).hard;
// Scenario 6: extreme level spread, maxGap 2
totalHard += check("12p/3c spread levels", mkPlayers(12, 0.33, (i) => LEVELS[i % 4]), { ...baseOpt }).hard;
// Scenario 7: 20 players 3 courts -> 8 rest each round, fairness
totalHard += check("20p/3c, heavy rest", mkPlayers(20, 0.4), { ...baseOpt }).hard;
// Scenario 8: all men
totalHard += check("12p/3c all men", mkPlayers(12, 0), { ...baseOpt, mensRounds: 2 }).hard;

console.log(`\n========================`);
console.log(`TOTAL HARD ISSUES ACROSS SCENARIOS: ${totalHard}`);
process.exit(totalHard === 0 ? 0 : 1);
