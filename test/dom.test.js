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
