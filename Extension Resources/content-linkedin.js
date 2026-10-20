// On a LinkedIn profile you open yourself, checks whether the person currently
// works at your target company and is US-based, then fills your note so you can
// copy it. It never clicks Connect or sends anything: you stay in control.

const US_STATES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky",
  "Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri",
  "Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York",
  "North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington",
  "West Virginia","Wisconsin","Wyoming","District of Columbia"];
const US_METROS = /(Bay Area|Greater (Seattle|Boston|Chicago|Austin|Denver|Atlanta|Houston|Dallas)|New York City|Los Angeles|Silicon Valley|Raleigh-Durham|DMV)/i;

function text(el) { return (el?.innerText || el?.textContent || "").trim(); }

function readProfile() {
  const main = document.querySelector("main") || document.body;
  const name = text(main.querySelector("h1"));
  const top = main.querySelector("section");

  // Location: the small grey line under the headline.
  let location = text(top?.querySelector("span.text-body-small.inline.t-black--light.break-words"));
  if (!location && top) {
    const spans = [...top.querySelectorAll("span")].map(text);
    location = spans.find(s => /, |Area$|United States|United Kingdom/.test(s) && s.length < 80) || "";
  }

  // Experience: first entry in the Experience section is usually the current role.
  const anchor = document.getElementById("experience");
  const expSection = anchor?.closest("section");
  const firstJob = text(expSection?.querySelector("li"));

  // Backup signal: the company link in the top card.
  const topCompany = [...(top?.querySelectorAll("[aria-label]") || [])]
    .map(el => el.getAttribute("aria-label"))
    .find(l => /current company/i.test(l)) || "";

  return { name, location, firstJob, topCompany };
}

function checkCompany(p, company) {
  const c = company.toLowerCase();
  if (p.firstJob) {
    const job = p.firstJob.toLowerCase();
    if (job.includes(c) && /present/.test(job)) return ["ok", `Current role at ${company}`];
    if (job.includes(c)) return ["maybe", `Lists ${company}, but may have left. Check their dates.`];
    return ["no", `Latest role isn't at ${company}`];
  }
  if (p.topCompany.toLowerCase().includes(c)) return ["ok", `Top card shows ${company}`];
  return ["maybe", "Couldn't read Experience yet. Scroll down, then click Re-check."];
}

function checkUS(location) {
  if (!location) return ["maybe", "No location found"];
  if (/United States/i.test(location)) return ["ok", location];
  if (US_STATES.some(s => new RegExp(`\\b${s}\\b`, "i").test(location))) return ["ok", location];
  if (US_METROS.test(location)) return ["ok", location];
  if (/,\s*(?!UK\b|EU\b)[A-Z]{2}\b/.test(location)) return ["ok", location];
  if (/Area$/i.test(location)) return ["maybe", `${location} (probably US, check to be sure)`];
  return ["no", location];
}

const ICON = { ok: "✓", no: "✗", maybe: "?" };

function render(profile) {
  document.querySelector(".ah-panel")?.remove();
  const company = profile.company || "your target company";
  const p = readProfile();
  const [cStatus, cDetail] = checkCompany(p, company);
  const [lStatus, lDetail] = checkUS(p.location);
  const first = (p.name.split(/\s+/)[0] || "there");
  const note = (profile.noteTemplate || "")
    .replaceAll("{first}", first)
    .replaceAll("{company}", company)
    .replaceAll("{role}", profile.role || "internship");
  const good = cStatus === "ok" && lStatus === "ok";

  const panel = document.createElement("div");
  panel.className = "ah-panel";
  panel.innerHTML = `
    <button class="ah-close" aria-label="Close">×</button>
    <h3>${good ? "Good fit for a referral" : "Check before you send"}</h3>
    <div class="ah-row"><span class="ah-${cStatus}">${ICON[cStatus]}</span>
      <span>Works at ${company}<br><span class="ah-detail"></span></span></div>
    <div class="ah-row"><span class="ah-${lStatus}">${ICON[lStatus]}</span>
      <span>Based in the US<br><span class="ah-detail"></span></span></div>
    <textarea class="ah-note" aria-label="Your note"></textarea>
    <div class="ah-count"></div>
    <button class="ah-btn" id="ah-copy">Copy note</button>
    <button class="ah-btn" id="ah-recheck" style="background:#5a6580">Re-check</button>`;
  const details = panel.querySelectorAll(".ah-detail");
  details[0].textContent = cDetail;
  details[1].textContent = lDetail;
  const box = panel.querySelector(".ah-note");
  const count = panel.querySelector(".ah-count");
  box.value = note;
  const updateCount = () => {
    count.textContent = `${box.value.length}/200`;
    count.classList.toggle("ah-over", box.value.length > 200);
  };
  box.addEventListener("input", updateCount);
  updateCount();

  panel.querySelector(".ah-close").onclick = () => panel.remove();
  panel.querySelector("#ah-recheck").onclick = () => render(profile);
  panel.querySelector("#ah-copy").onclick = async () => {
    await navigator.clipboard.writeText(box.value);
    panel.querySelector("#ah-copy").textContent = "Copied";
    setTimeout(() => (panel.querySelector("#ah-copy").textContent = "Copy note"), 1500);
  };
  document.body.appendChild(panel);
}

// LinkedIn is a single-page app, so watch for navigation to a new profile.
let lastUrl = "";
setInterval(() => {
  const url = location.href.split("?")[0];
  if (url === lastUrl) return;
  lastUrl = url;
  document.querySelector(".ah-panel")?.remove();
  if (/linkedin\.com\/in\/[^/]+\/?$/.test(url)) {
    setTimeout(() => chrome.storage.local.get("profile", ({ profile = {} }) => render(profile)), 2000);
  }
}, 1000);
