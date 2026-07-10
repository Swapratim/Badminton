/* Headless DOM smoke test: loads index.html with jsdom, runs the real
   scripts, drives the UI, and asserts the schedule renders with no errors. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const pub = path.join(__dirname, "..", "public");
let html = fs.readFileSync(path.join(pub, "index.html"), "utf8");
// inline the scripts so jsdom runs them without a server
const scheduler = fs.readFileSync(path.join(pub, "scheduler.js"), "utf8");
const app = fs.readFileSync(path.join(pub, "app.js"), "utf8");
html = html
  .replace('<script src="scheduler.js"></script>', `<script>${scheduler}</script>`)
  .replace('<script src="app.js"></script>', `<script>${app}</script>`);

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  beforeParse(window) {
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.addEventListener("error", e => errors.push("error: " + e.message));
  },
});
const { window } = dom;
const doc = window.document;

function fail(m) { console.error("✗ " + m); process.exitCode = 1; }
function ok(m) { console.log("✓ " + m); }

// DOMContentLoaded fires async in jsdom; wait a tick.
setTimeout(() => {
  try {
    const rows = doc.querySelectorAll(".player-row");
    rows.length === 12 ? ok(`player rows built (${rows.length})`) : fail(`expected 12 rows, got ${rows.length}`);

    // sample names
    doc.getElementById("fillSample").click();
    const named = [...doc.querySelectorAll(".p-name")].filter(i => i.value).length;
    named === 12 ? ok("sample names filled") : fail("sample fill failed: " + named);

    // generate
    doc.getElementById("generate").click();
    const out = doc.getElementById("output");
    !out.hidden ? ok("output revealed") : fail("output still hidden");
    const tables = doc.querySelectorAll("table.sched");
    tables.length === 10 ? ok(`10 round tables rendered`) : fail(`expected 10 tables, got ${tables.length}`);
    const tune = doc.getElementById("tuneCard");
    !tune.hidden ? ok("tuning panel revealed") : fail("tuning panel hidden");

    // edit player names in the generated table
    doc.getElementById("editNames").click();
    const editable = doc.querySelectorAll('#printable .pname[contenteditable="true"]').length;
    editable > 0 ? ok(`edit mode: ${editable} names editable`) : fail("no editable names after clicking Edit names");
    // rename player id 0 everywhere via the first occurrence
    const first = doc.querySelector('#printable .pname[data-pid="0"]');
    if (!first) fail("no name cell for player 0");
    else {
      const before = first.textContent;
      first.textContent = "Zephyrina";
      first.dispatchEvent(new window.Event("focusout", { bubbles: true }));
      const occ = [...doc.querySelectorAll('#printable .pname[data-pid="0"]')];
      const allRenamed = occ.length > 0 && occ.every(el => el.textContent === "Zephyrina");
      const builderInput = doc.querySelectorAll(".player-row .p-name")[0];
      (allRenamed && builderInput.value === "Zephyrina")
        ? ok(`rename propagated to all ${occ.length} occurrences + builder (was "${before}")`)
        : fail(`rename not propagated: cells=${occ.map(e=>e.textContent).join(",")} input=${builderInput.value}`);
    }

    // change level for player 0 (propagates + syncs builder)
    const lvlSel = doc.querySelector('#printable .lvl-sel[data-pid="0"]');
    if (!lvlSel) fail("no level control in edit mode");
    else {
      lvlSel.value = "L4";
      lvlSel.dispatchEvent(new window.Event("change", { bubbles: true }));
      const builderLvl = doc.querySelectorAll(".player-row .p-level")[0].value;
      const allL4 = [...doc.querySelectorAll('#printable .lvl-sel[data-pid="0"]')].every(s => s.value === "L4");
      (builderLvl === "L4" && allL4) ? ok("level change propagated to all occurrences + builder") : fail(`level not propagated: builder=${builderLvl}`);
    }

    // toggle gender for player 0 (propagates + syncs builder + flips ♂/♀)
    const g0 = doc.querySelector('#printable .pg-toggle[data-pid="0"]');
    if (!g0) fail("no gender control in edit mode");
    else {
      const wasWoman = doc.querySelectorAll(".player-row .p-woman")[0].checked;
      g0.click();
      const nowWoman = doc.querySelectorAll(".player-row .p-woman")[0].checked;
      const btnTxt = doc.querySelector('#printable .pg-toggle[data-pid="0"]').textContent;
      (nowWoman === !wasWoman && (nowWoman ? btnTxt === "♀" : btnTxt === "♂"))
        ? ok(`gender toggle propagated (woman ${wasWoman}→${nowWoman})`) : fail(`gender not toggled: ${wasWoman}->${nowWoman} btn=${btnTxt}`);
    }

    // custom rule add
    doc.getElementById("customRuleInput").value = "Keep Riya & Sam apart";
    doc.getElementById("addRule").click();
    const notes = doc.getElementById("printNotes").textContent;
    notes.includes("Riya") ? ok("custom note added to sheet") : fail("custom note missing");

    // duration -> rounds (rule A)
    const dur = doc.getElementById("duration");
    dur.value = "3";
    dur.dispatchEvent(new window.Event("input"));
    doc.getElementById("numRounds").value === "15" ? ok("3 hr → 15 rounds (rule A)") : fail("rounds auto = " + doc.getElementById("numRounds").value);

    // share text builds
    const meta = doc.getElementById("printMeta").textContent;
    meta.includes("players") ? ok("print meta populated") : fail("meta empty");

    errors.length === 0 ? ok("no uncaught JS errors") : fail("JS errors: " + errors.join("; "));

    console.log(process.exitCode ? "\nDOM TEST: FAILED" : "\nDOM TEST: PASSED");
  } catch (e) {
    fail("exception: " + e.stack);
  }
}, 300);
