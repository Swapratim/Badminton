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

    // feature 2: the schedule view shows names only — no per-player ·level / ♀ span
    !doc.querySelector("table.sched td.team .lvl") && !doc.querySelector("table.sched td.team .w")
      ? ok("view table has no per-player level/gender text") : fail("view still renders level/gender text");

    // ---- staged edit → Save ----
    doc.getElementById("editNames").click();
    (!doc.getElementById("saveNames").hidden && doc.getElementById("editNames").hidden)
      ? ok("edit mode: Save shown, Edit hidden") : fail("edit/save button toggle wrong");
    const editable = doc.querySelectorAll('#printable .pname[contenteditable="true"]').length;
    editable > 0 ? ok(`edit mode: ${editable} names editable`) : fail("no editable names");

    // per-cell name editing: pick a player appearing in >= 2 match cells
    const p0cells = [...doc.querySelectorAll('#printable .pname[data-pid="0"]')];
    p0cells.length >= 2 ? ok(`player 0 appears in ${p0cells.length} cells`) : fail("player 0 not in multiple cells");
    const origName = p0cells[0].textContent;
    const cellKey = p0cells[0].dataset.cell;
    // edit ONLY the first cell — must NOT propagate to the player's other cells
    p0cells[0].textContent = "SoloEdit";
    p0cells[0].dispatchEvent(new window.Event("input", { bubbles: true }));
    [...doc.querySelectorAll('#printable .pname[data-pid="0"]')]
      .filter(el => el.dataset.cell !== cellKey).every(el => el.textContent === origName)
      ? ok("per-cell: editing one cell leaves the player's other cells unchanged") : fail("name edit propagated to other cells");

    // stage level + gender (still per-player)
    const lvlSel = doc.querySelector('#printable .lvl-sel[data-pid="0"]');
    lvlSel.value = "L4"; lvlSel.dispatchEvent(new window.Event("change", { bubbles: true }));
    const wasWoman = doc.querySelectorAll(".player-row .p-woman")[0].checked;
    doc.querySelector('#printable .pg-toggle[data-pid="0"]').click();

    // Save → only the edited cell keeps the new name; others stay original
    doc.getElementById("saveNames").click();
    const editedCell = doc.querySelector(`#printable .pname[data-cell="${cellKey}"]`);
    const others = [...doc.querySelectorAll('#printable .pname[data-pid="0"]')].filter(el => el.dataset.cell !== cellKey);
    (editedCell && editedCell.textContent === "SoloEdit" && others.length && others.every(el => el.textContent === origName))
      ? ok("Save: only the edited cell keeps the new name; others unchanged")
      : fail(`per-cell save wrong: edited=${editedCell && editedCell.textContent} others=${others.map(e=>e.textContent).join(",")}`);
    doc.querySelectorAll(".player-row .p-name")[0].value === origName
      ? ok("builder name unchanged by per-cell edit") : fail(`builder name changed: ${doc.querySelectorAll(".player-row .p-name")[0].value}`);
    const sL = doc.querySelectorAll(".player-row .p-level")[0].value;
    const sW = doc.querySelectorAll(".player-row .p-woman")[0].checked;
    (sL === "L4" && sW === !wasWoman) ? ok("level & gender still saved per-player") : fail(`lvl/gender save: ${sL} ${wasWoman}->${sW}`);
    (doc.getElementById("editNames").hidden === false && doc.getElementById("saveNames").hidden === true)
      ? ok("Save returns to view mode") : fail("view mode not restored after Save");

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
