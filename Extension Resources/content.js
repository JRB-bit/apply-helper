/*
 * Apply Helper — content script
 * Learns every answer you type into an application form and fills it in next time.
 * Everything stays on your Mac (browser.storage.local). Nothing is sent anywhere.
 */
(() => {
  'use strict';
  if (window.__applyHelperLoaded) return;
  window.__applyHelperLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const MEM_KEY = 'ah_memory_v2';
  const SET_KEY = 'ah_settings_v2';
  const DEFAULT_SETTINGS = { learn: true, autoFill: 'ats', pausedSites: [] };
  const ROOT_ID = 'apply-helper-root';

  // Job-application sites where filling happens automatically (setting "ats").
  const ATS = /(greenhouse\.io|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|workday\.com|ashbyhq\.com|smartrecruiters\.com|icims\.com|jobvite\.com|taleo\.net|bamboohr\.com|workable\.com|recruitee\.com|breezy\.hr|applytojob\.com|successfactors\.(com|eu)|oraclecloud\.com|rippling(-ats)?\.com|dover\.com|wellfound\.com|linkedin\.com\/jobs|indeed\.com|joinhandshake\.com|paylocity\.com|ultipro\.com|ukg\.com|adp\.com|teamtailor\.com|pinpointhq\.com|personio\.(com|de)|jazzhr\.com|gem\.com|eightfold\.ai|phenom|avature\.net|hire\.withgoogle\.com|careers?\.|jobs\.)/i;

  // Never learn or fill these.
  const SENSITIVE = /password|passcode|\bssn\b|social security|social insurance|credit card|card number|\bcvv\b|\bcvc\b|security code|routing number|account number|bank|\bpin\b|captcha|one[- ]time|\botp\b|verification code|date of birth|\bdob\b|birth ?date|birthday|driver'?s? licen[cs]e|passport|tax id|\bitin\b|\bein\b/i;
  // Checkboxes you should tick yourself (legal attestations, consent).
  const CONSENT = /agree|consent|terms|privacy|acknowledg|certify|attest|confirm that|i understand|accept|subscribe|newsletter|marketing|text me|sms/i;
  const PLACEHOLDER_OPTION = /^\s*$|^(please\s+)?(select|choose|pick)\b|^[-—–.\s]+$/i;

  // Common fields: one shared answer however each site words the question.
  // longOk = the pattern is reliable even inside a long question sentence.
  const CANON = [
    ['email', 'Email', /e-?mail/],
    ['preferredName', 'Preferred name', /preferred[\s_-]*(first[\s_-]*)?name|nick[\s_-]*name/],
    ['firstName', 'First name', /\b(first|given|fore)[\s_-]*name|\bfname\b|first_?name/],
    ['middleName', 'Middle name', /middle[\s_-]*(name|initial)/],
    ['lastName', 'Last name', /\b(last|family|sur)[\s_-]*name|\blname\b|last_?name|surname/],
    ['fullName', 'Full name', /^(your\s+)?(full\s+|legal\s+)?name$|\bfull[\s_-]*name|legal name|^name\b/],
    ['phone', 'Phone', /phone|mobile|\bcell\b|telephone|\btel\b/],
    ['linkedin', 'LinkedIn', /linked[\s_-]*in/, true],
    ['github', 'GitHub', /git[\s_-]*hub/, true],
    ['twitter', 'X / Twitter', /twitter|\bx\.com\b/],
    ['portfolio', 'Portfolio / website', /portfolio|personal (web)?site|^website|website url|\bwebsite\b|^url$|\bblog\b/],
    ['address2', 'Address line 2', /address[\s_-]*(line)?[\s_-]*2|\bapt\b|apartment|suite|\bunit\b/],
    ['address1', 'Street address', /address[\s_-]*(line)?[\s_-]*1|street|^(home |mailing |current )?address$/],
    ['city', 'City', /\bcity\b|\btown\b/],
    ['state', 'State', /\bstate\b|province|\bregion\b/],
    ['zip', 'ZIP code', /\bzip\b|zip[\s_-]?code|postal|post[\s_-]*code/],
    ['country', 'Country', /\bcountry\b/],
    ['location', 'Location', /^location|current location|where are you (currently )?(based|located)|city,? state/, true],
    ['school', 'School', /\bschool\b|university|college|institution/],
    ['degree', 'Degree', /\bdegree\b/],
    ['major', 'Major', /\bmajor\b|field of study|discipline|concentration/],
    ['gpa', 'GPA', /\bgpa\b|grade point/, true],
    ['gradDate', 'Graduation date', /graduat/],
    ['company', 'Current company', /current (company|employer)|company name|^employer|most recent (company|employer)/],
    ['title', 'Current job title', /current (job )?title|^job title|position title|current role|^title$/],
    ['yearsExp', 'Years of experience', /years of (relevant |professional |work )?experience|how many years/, true],
    ['salary', 'Salary expectation', /salary|compensation expectation|desired (pay|compensation)|pay expectation|expected (pay|compensation)/, true],
    ['startDate', 'Earliest start date', /start date|available to start|when can you start|earliest (date|start)/, true],
    ['workAuth', 'Authorized to work', /authori[sz]ed to work|legally (authori[sz]ed|eligible|able|permitted)|work authori[sz]ation|eligible to work|right to work/, true],
    ['sponsorship', 'Needs visa sponsorship', /sponsor/, true],
    ['relocate', 'Willing to relocate', /relocat/, true],
    ['onsite', 'OK working on-site', /(in[- ]office|on[- ]?site|hybrid|in person).*(work|comfortable|able|willing)|(work|comfortable|able|willing).*(in[- ]office|on[- ]?site|hybrid|in person)/, true],
    ['over18', 'Over 18', /18 years|over 18|at least 18/, true],
    ['pronouns', 'Pronouns', /pronoun/, true],
    ['gender', 'Gender', /gender|^sex$/, true],
    ['hispanic', 'Hispanic or Latino', /hispanic|latin[oax]/, true],
    ['race', 'Race / ethnicity', /\brace\b|ethnic/, true],
    ['veteran', 'Veteran status', /veteran|protected veteran|military/, true],
    ['disability', 'Disability status', /disabilit/, true],
    ['referral', 'How you heard about us', /how did you (hear|find|learn)|where did you (hear|find)|referral source|^source$/, true],
  ];
  const AUTOCOMPLETE = {
    'given-name': 'firstName', 'family-name': 'lastName', 'additional-name': 'middleName', name: 'fullName',
    nickname: 'preferredName', email: 'email', tel: 'phone', 'tel-national': 'phone', 'address-line1': 'address1',
    'street-address': 'address1', 'address-line2': 'address2', 'address-level2': 'city', 'address-level1': 'state',
    'postal-code': 'zip', country: 'country', 'country-name': 'country', organization: 'company',
    'organization-title': 'title', url: 'portfolio', sex: 'gender',
  };
  const STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia' };
  const STOP = new Set('a an the and or of to for in on at is are be you your yours do does did have has what which who how please if with this that from by as it we our us any will would can could should may'.split(' '));

  let memory = { entries: {} };
  let settings = { ...DEFAULT_SETTINGS };
  const filledByUs = new WeakMap();   // element -> value we put there
  const autoTried = new WeakSet();    // elements we already auto-filled once
  const lastLearned = new WeakMap();  // element -> last value saved
  let pillDismissed = false;

  // ---------- storage ----------
  async function load() {
    try {
      const got = await api.storage.local.get([MEM_KEY, SET_KEY]);
      memory = got[MEM_KEY] && got[MEM_KEY].entries ? got[MEM_KEY] : { entries: {} };
      settings = { ...DEFAULT_SETTINGS, ...(got[SET_KEY] || {}) };
    } catch (e) { /* storage unavailable */ }
  }
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { api.storage.local.set({ [MEM_KEY]: memory }).catch?.(() => {}); }, 250);
  }
  try {
    api.storage.onChanged.addListener((changes, area) => {
      if (area && area !== 'local') return;
      if (changes[MEM_KEY]) memory = changes[MEM_KEY].newValue || { entries: {} };
      if (changes[SET_KEY]) settings = { ...DEFAULT_SETTINGS, ...(changes[SET_KEY].newValue || {}) };
    });
  } catch (e) { /* ignore */ }

  const paused = () => (settings.pausedSites || []).includes(location.hostname);

  // ---------- text helpers ----------
  const clean = (s) => (s || '').replace(/\s+/g, ' ').replace(/\s*\*+\s*/g, ' ').replace(/\(?\b(required|optional)\b\)?/gi, '').replace(/[:\s]+$/, '').trim();
  const textOf = (n) => (n ? clean(n.innerText ?? n.textContent) : '');
  const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+#]+/g, ' ').trim();
  const stem = (w) => (w.length > 5 ? w.replace(/(ing|ed|es|s)$/, '') : w);
  const tokens = (s) => norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
  function similarity(a, b) {
    const A = new Set(tokens(a)), B = new Set(tokens(b));
    if (!A.size || !B.size) return 0;
    let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
    return inter / (A.size + B.size - inter);
  }
  const humanize = (s) => (s || '').replace(/\[\d*\]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.[\]]+/g, ' ').trim();

  // ---------- reading the form ----------
  const isField = (el) => el && el.nodeType === 1 && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
  const typeOf = (el) => (el.tagName === 'INPUT' ? (el.type || 'text').toLowerCase() : el.tagName.toLowerCase());
  const visible = (el) => !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');

  function eligible(el) {
    if (!isField(el) || el.disabled || el.readOnly) return false;
    if (el.closest('#' + ROOT_ID)) return false;
    const t = typeOf(el);
    if (['hidden', 'password', 'file', 'submit', 'button', 'reset', 'image', 'search', 'range', 'color'].includes(t)) return false;
    if (t === 'radio' || t === 'checkbox') {
      const lab = optionLabelEl(el);
      return visible(el) || (lab && visible(lab));
    }
    return visible(el);
  }

  function optionLabelEl(el) {
    if (el.id) { try { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return l; } catch (e) {} }
    return el.closest('label');
  }

  function directLabel(el) {
    const ids = el.getAttribute('aria-labelledby');
    if (ids) { const t = clean(ids.split(/\s+/).map((id) => textOf(document.getElementById(id))).join(' ')); if (t) return t; }
    if (el.id) {
      try { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); const t = textOf(l); if (t) return t; } catch (e) {}
    }
    const anc = el.closest('label');
    if (anc) { const t = textOf(anc); if (t) return t; }
    const al = clean(el.getAttribute('aria-label'));
    return al || '';
  }

  // Text right before the element, from the nearest block (the question above a field).
  const BLOCK = 'label,legend,p,h1,h2,h3,h4,h5,h6,li,td,th,dt,dd,div,section,fieldset';
  function precedingText(el, limit = 300) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    walker.currentNode = el;
    let acc = '', block = null, steps = 0;
    while (walker.previousNode() && steps++ < 500) {
      const n = walker.currentNode;
      if (n.nodeType === 1) {
        if (n.matches('input:not([type=hidden]),select,textarea,button')) break;
        continue;
      }
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      const p = n.parentElement;
      if (!t || !p || p.closest('script,style,noscript,#' + ROOT_ID) || /^\*+$/.test(t)) continue;
      if (!p.getClientRects().length) continue;
      const b = p.closest(BLOCK);
      if (block && b !== block && !block.contains(b) && !(b && b.contains(block))) break;
      block = block || b;
      acc = t + ' ' + acc;
      if (acc.length > limit) break;
    }
    return clean(acc);
  }

  function groupMembers(el) {
    const t = typeOf(el);
    if (el.name) {
      const scope = el.form || document;
      let same = [];
      try { same = [...scope.querySelectorAll(`input[type="${t}"][name="${CSS.escape(el.name)}"]`)]; } catch (e) {}
      if (same.length > 1 || t === 'radio') return same.length ? same : [el];
    }
    const box = el.closest('fieldset,[role=group],[role=radiogroup]');
    if (box) { const m = [...box.querySelectorAll(`input[type="${t}"]`)]; if (m.length > 1) return m; }
    return [el];
  }

  function groupQuestion(members) {
    const first = members[0];
    const fs = first.closest('fieldset');
    const legend = fs && fs.querySelector('legend');
    if (legend && textOf(legend)) return textOf(legend);
    const rg = first.closest('[role=radiogroup],[role=group]');
    if (rg) { const t = directLabel(rg); if (t) return t; }
    if (members.length === 1) {
      return directLabel(first) || precedingText(first);
    }
    // Text before the first option (or before its label, when the label comes first).
    const lab = optionLabelEl(first);
    const start = lab && lab.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING ? lab : first;
    return precedingText(start) || humanize(first.name);
  }

  function optionText(el) {
    return directLabel(el) || clean(el.value) || '';
  }

  function canonicalFor(question, el) {
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/).pop();
    if (AUTOCOMPLETE[ac]) return AUTOCOMPLETE[ac];
    const q = norm(question);
    const attrs = norm(humanize([el.name, el.id, el.getAttribute('data-automation-id'), el.getAttribute('data-qa')].filter(Boolean).join(' ')));
    const short = q.length <= 60;
    for (const [key, , re, longOk] of CANON) {
      if ((short || longOk) && re.test(q)) return key;
    }
    if (!q || q.length < 4) for (const [key, , re] of CANON) if (re.test(attrs)) return key;
    if (typeOf(el) === 'email') return 'email';
    if (typeOf(el) === 'tel') return 'phone';
    return null;
  }

  // Describe a field (or a radio/checkbox group) in a stable way.
  function describe(el) {
    const t = typeOf(el);
    let members = [el], question, kind;
    if (t === 'radio' || t === 'checkbox') {
      members = groupMembers(el);
      question = groupQuestion(members);
      kind = t === 'radio' ? 'choice' : members.length > 1 ? 'multi' : 'check';
      if (kind === 'check') question = optionText(el) || question;
    } else {
      question = directLabel(el) || clean(el.getAttribute('placeholder')) || clean(el.getAttribute('title')) || precedingText(el) || humanize(el.name || el.id);
      kind = t === 'select' || t === 'select-one' ? 'choice' : 'text';
      if (el.multiple) kind = 'multi';
    }
    question = question.slice(0, 300);
    const hint = [question, el.name, el.id, el.getAttribute('placeholder'), el.getAttribute('autocomplete')].join(' ');
    const sensitive = SENSITIVE.test(hint) || (kind === 'check' && CONSENT.test(question));
    const canon = canonicalFor(question, el);
    const key = canon ? 'c:' + canon : 'q:' + norm(question).slice(0, 200);
    const label = canon ? CANON.find((c) => c[0] === canon)?.[1] || canon : question;
    return { el, members, type: t, kind, question, key, canon, label, sensitive };
  }

  function currentValue(info) {
    const { el, kind, members } = info;
    if (kind === 'text') return el.value.trim();
    if (el.tagName === 'SELECT') {
      const texts = [...el.selectedOptions].map((o) => clean(o.text)).filter((t) => t && !PLACEHOLDER_OPTION.test(t));
      return kind === 'multi' ? texts : texts[0] || '';
    }
    if (kind === 'choice') { const c = members.find((m) => m.checked); return c ? optionText(c) : ''; }
    if (kind === 'multi') return members.filter((m) => m.checked).map(optionText);
    if (kind === 'check') return el.checked ? 'Yes' : 'No';
    return '';
  }
  const isEmpty = (v) => (Array.isArray(v) ? v.length === 0 : !v);

  // ---------- memory lookup ----------
  function lookup(info) {
    const E = memory.entries;
    if (E[info.key]) return { entry: E[info.key], exact: true };
    if (info.canon) {
      const f = E['c:firstName'], l = E['c:lastName'], full = E['c:fullName'];
      if (info.canon === 'fullName' && f && l) return { entry: { value: `${f.value} ${l.value}` }, exact: true };
      if (full && typeof full.value === 'string') {
        const parts = full.value.trim().split(/\s+/);
        if (info.canon === 'firstName' && parts.length > 1) return { entry: { value: parts[0] }, exact: true };
        if (info.canon === 'lastName' && parts.length > 1) return { entry: { value: parts.slice(1).join(' ') }, exact: true };
      }
      if (info.canon === 'location' && E['c:city'] && E['c:state']) return { entry: { value: `${E['c:city'].value}, ${E['c:state'].value}` }, exact: false };
      return null;
    }
    // Similar wording of a question you answered before.
    let best = null, bestScore = 0;
    for (const k in E) {
      if (!k.startsWith('q:')) continue;
      const e = E[k];
      if ((info.kind === 'text') !== (e.kind === 'text')) continue;
      const s = similarity(info.question, e.label);
      if (s > bestScore) { bestScore = s; best = e; }
    }
    if (best && bestScore >= 0.6) return { entry: best, exact: bestScore >= 0.95 };
    return null;
  }

  // ---------- learning ----------
  function learn(el) {
    if (!settings.learn || paused() || !eligible(el)) return;
    const info = describe(el);
    if (info.sensitive || !info.question) return;
    let value = currentValue(info);
    if (isEmpty(value)) return;
    if (typeof value === 'string' && value.length > 8000) return;
    const ours = filledByUs.get(info.members[0]) ?? filledByUs.get(el);
    const sig = JSON.stringify(value);
    if (ours !== undefined && JSON.stringify(ours) === sig) return; // untouched fill
    if (lastLearned.get(info.members[0]) === sig) return;
    lastLearned.set(info.members[0], sig);

    const prev = memory.entries[info.key];
    const changed = !prev || JSON.stringify(prev.value) !== sig;
    memory.entries[info.key] = {
      key: info.key, label: info.label, value, kind: info.kind,
      count: (prev?.count || 0) + 1, updated: Date.now(),
      site: location.hostname, created: prev?.created || Date.now(),
    };
    save();
    if (changed) toast(prev ? `Updated “${short(info.label)}”` : `Learned “${short(info.label)}”`);
  }
  const short = (s) => (s.length > 42 ? s.slice(0, 40) + '…' : s);

  function onUserEdit(e) {
    if (!e.isTrusted) return;
    const el = e.target;
    if (!isField(el)) return;
    setTimeout(() => learn(el), 0);
  }
  document.addEventListener('change', onUserEdit, true);
  document.addEventListener('focusout', onUserEdit, true);
  document.addEventListener('submit', () => {
    document.querySelectorAll('input,select,textarea').forEach((el) => { try { learn(el); } catch (e) {} });
  }, true);

  // ---------- filling ----------
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    el.focus({ preventScroll: true });
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function expandState(v) {
    const up = (v || '').trim().toUpperCase();
    if (STATES[up]) return [v, STATES[up]];
    const abbr = Object.keys(STATES).find((k) => STATES[k].toLowerCase() === (v || '').trim().toLowerCase());
    return abbr ? [v, abbr] : [v];
  }

  function bestOption(options, wanted) {
    // options: [{text, value, ref}]
    let best = null, bestScore = 0;
    for (const w of expandState(wanted)) {
      const nw = norm(w);
      if (!nw) continue;
      for (const o of options) {
        const nt = norm(o.text), nv = norm(o.value);
        let s = 0;
        if (nt === nw || nv === nw) s = 1;
        else if (/^(yes|no)\b/.test(nw) && nt.startsWith(nw.split(' ')[0]) && nw.split(' ')[0] === nt.split(' ')[0]) s = 0.85;
        else if (nt.length > 2 && (nt.includes(nw) || nw.includes(nt))) s = 0.8 * Math.min(nt.length, nw.length) / Math.max(nt.length, nw.length) + 0.15;
        else s = similarity(o.text, w);
        if (s > bestScore) { bestScore = s; best = o; }
      }
    }
    return bestScore >= 0.5 ? best : null;
  }

  function adaptText(el, value) {
    let v = Array.isArray(value) ? value.join(', ') : String(value);
    const t = typeOf(el);
    if (t === 'number') { const m = v.replace(/,/g, '').match(/-?\d+(\.\d+)?/); v = m ? m[0] : ''; }
    if (t === 'email' && !/@/.test(v)) return '';
    if (t === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { const d = new Date(v); v = isNaN(d) ? '' : d.toISOString().slice(0, 10); }
    if (el.maxLength > 0 && v.length > el.maxLength) return '';
    return v;
  }

  function fillOne(info, entry) {
    const { el, kind, members } = info;
    const value = entry.value;
    if (kind === 'text') {
      if (el.value.trim()) return false;
      const v = adaptText(el, value);
      if (!v) return false;
      setNativeValue(el, v);
      filledByUs.set(el, el.value.trim());
      return true;
    }
    if (el.tagName === 'SELECT') {
      if (!isEmpty(currentValue(info))) return false;
      const opts = [...el.options].filter((o) => !PLACEHOLDER_OPTION.test(clean(o.text))).map((o) => ({ text: clean(o.text), value: o.value, ref: o }));
      const wants = Array.isArray(value) ? value : [value];
      let any = false;
      if (el.multiple) {
        wants.forEach((w) => { const o = bestOption(opts, w); if (o) { o.ref.selected = true; any = true; } });
        if (any) el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        const o = bestOption(opts, wants[0]);
        if (o) { setNativeValue(el, o.value); any = true; }
      }
      if (any) filledByUs.set(el, currentValue(info));
      return any;
    }
    if (kind === 'choice' || kind === 'multi') {
      if (!isEmpty(currentValue(info))) return false;
      const opts = members.map((m) => ({ text: optionText(m), value: m.value, ref: m }));
      const wants = Array.isArray(value) ? value : [value];
      let any = false;
      for (const w of wants) {
        const o = bestOption(opts, w);
        if (o && !o.ref.checked) { o.ref.click(); any = true; }
        if (kind === 'choice') break;
      }
      if (any) filledByUs.set(members[0], currentValue(info));
      return any;
    }
    if (kind === 'check') {
      if (el.checked || value !== 'Yes') return false;
      el.click();
      filledByUs.set(el, currentValue(info));
      return true;
    }
    return false;
  }

  function buildPlan() {
    const plan = [], seen = new Set();
    for (const el of document.querySelectorAll('input,select,textarea')) {
      if (!eligible(el)) continue;
      const t = typeOf(el);
      if ((t === 'radio' || t === 'checkbox')) {
        const members = groupMembers(el);
        if (seen.has(members[0])) continue;
        members.forEach((m) => seen.add(m));
      }
      let info;
      try { info = describe(el); } catch (e) { continue; }
      if (info.sensitive || !info.question) continue;
      if (!isEmpty(currentValue(info))) continue;
      const hit = lookup(info);
      if (hit) plan.push({ info, entry: hit.entry, review: !hit.exact || info.type === 'textarea' });
    }
    return plan;
  }

  function mark(info, review) {
    const target = info.kind === 'text' || info.el.tagName === 'SELECT' ? info.el : (optionLabelEl(info.members.find((m) => m.checked) || info.el) || info.el);
    const color = review ? '#F59E0B' : '#E8A317';
    const prev = target.style.boxShadow;
    target.style.boxShadow = `0 0 0 2px ${color}, 0 0 0 5px ${review ? 'rgba(245,158,11,.25)' : 'rgba(232,163,23,.22)'}`;
    if (review) target.title = target.title || 'Apply Helper filled this from a similar question — check it';
    const clear = () => { target.style.boxShadow = prev; target.removeEventListener('focus', clear); };
    target.addEventListener('focus', clear);
    setTimeout(clear, 12000);
  }

  // Attach the résumé saved in Settings to the résumé/CV upload box, if empty.
  let resumeBusy = false;
  const resumeTried = new WeakSet();
  async function attachResume() {
    if (resumeBusy) return false;
    const inputs = [...document.querySelectorAll('input[type=file]')].filter((el) => !el.disabled && !el.files.length && !resumeTried.has(el));
    if (!inputs.length) return false;
    const hint = (el) => [directLabel(el), precedingText(el), el.name, el.id, el.getAttribute('accept')].join(' ');
    const target = inputs.find((el) => /resume|résumé|\bcv\b|curriculum/i.test(hint(el)) && !/cover/i.test(hint(el))) || (inputs.length === 1 && !/cover|transcript|portfolio/i.test(hint(inputs[0])) ? inputs[0] : null);
    if (!target) return false;
    resumeTried.add(target);
    resumeBusy = true;
    try {
      const { resume } = await api.storage.local.get('resume');
      if (!resume || !resume.data) return false;
      const blob = await (await fetch(resume.data)).blob();
      const dt = new DataTransfer();
      dt.items.add(new File([blob], resume.name, { type: resume.type || blob.type }));
      target.files = dt.files;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      toast(`Attached ${resume.name}`);
      return true;
    } catch (e) { return false; } finally { resumeBusy = false; }
  }

  function fillNow(planIn) {
    attachResume();
    const plan = planIn || buildPlan();
    let filled = 0, review = 0;
    for (const p of plan) {
      autoTried.add(p.info.members[0]);
      try {
        if (fillOne(p.info, p.entry)) { filled++; if (p.review) review++; mark(p.info, p.review); }
      } catch (e) { /* skip field */ }
    }
    return { filled, review };
  }

  // ---------- on-page UI (shadow DOM so sites can't restyle it) ----------
  let root, pill, toastEl, toastTimer;
  function ui() {
    if (root && root.isConnected) return;
    const host = document.createElement('div');
    host.id = ROOT_ID;
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;right:18px;bottom:18px;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{all:initial}
        .wrap{display:flex;flex-direction:column;align-items:flex-end;gap:8px;font:13px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif}
        .pill{display:none;align-items:center;gap:2px;background:#2B3FC7;color:#FFFFFF;border-radius:999px;padding:4px 4px 4px 6px;box-shadow:0 8px 28px rgba(43,63,199,.35),0 0 0 1px rgba(255,255,255,.08) inset}
        .pill.show{display:flex}
        .go{all:unset;cursor:pointer;display:flex;align-items:center;gap:7px;padding:6px 10px 6px 4px;border-radius:999px;font-weight:600}
        .go:hover{background:rgba(255,255,255,.08)}
        .flame{width:20px;height:20px;flex:none}
        .x{all:unset;cursor:pointer;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:rgba(255,246,230,.6);font-size:15px}
        .x:hover{background:rgba(255,255,255,.1);color:#FFF6E6}
        .toast{opacity:0;transform:translateY(6px);transition:.2s;background:#FFFFFF;color:#1E2A78;border:1px solid #D9E0F7;border-radius:10px;padding:7px 11px;box-shadow:0 6px 20px rgba(0,0,0,.12);max-width:300px;pointer-events:none}
        .toast.show{opacity:1;transform:none}
        @media (prefers-color-scheme: dark){.toast{background:#1B2150;color:#EEF2FF;border-color:#33408F}}
      </style>
      <div class="wrap">
        <div class="toast" role="status"></div>
        <div class="pill">
          <button class="go" title="Fill with your saved answers (⌃⇧F)">
            <svg class="flame" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#F5B000"/><path d="M13.2 4.5 8 13h3.6l-1.2 6.5L16 11h-3.6z" fill="#fff"/></svg>
            <span class="label">Fill</span>
          </button>
          <button class="x" title="Hide on this page">×</button>
        </div>
      </div>`;
    (document.body || document.documentElement).appendChild(host);
    pill = root.querySelector('.pill');
    toastEl = root.querySelector('.toast');
    root.querySelector('.go').addEventListener('click', () => {
      const r = fillNow();
      pill.classList.remove('show');
      toast(r.filled ? `Filled ${r.filled} ${r.filled === 1 ? 'answer' : 'answers'}${r.review ? ` · ${r.review} to check (amber)` : ''}` : 'Nothing new to fill here');
    });
    root.querySelector('.x').addEventListener('click', () => { pillDismissed = true; pill.classList.remove('show'); });
  }

  function toast(msg) {
    if (window.top !== window && !document.querySelector('form')) return;
    ui();
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function showPill(n) {
    if (pillDismissed) return;
    ui();
    root.querySelector('.label').textContent = `Fill ${n} ${n === 1 ? 'answer' : 'answers'}`;
    pill.classList.add('show');
  }
  function hidePill() { if (pill) pill.classList.remove('show'); }

  // ---------- scanning ----------
  function scan() {
    if (paused() || !document.body) { hidePill(); return; }
    const plan = buildPlan();
    const fresh = plan.filter((p) => !autoTried.has(p.info.members[0]));
    const auto = settings.autoFill === 'always' || (settings.autoFill === 'ats' && ATS.test(location.href));
    if (auto && fresh.length) {
      const r = fillNow(fresh);
      if (r.filled) toast(`Filled ${r.filled} ${r.filled === 1 ? 'answer' : 'answers'}${r.review ? ` · ${r.review} to check (amber)` : ''}`);
      hidePill();
      return;
    }
    if (plan.length) showPill(plan.length); else hidePill();
  }

  let scanTimer;
  const queueScan = () => { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 700); };
  new MutationObserver((muts) => {
    if (muts.every((m) => m.target.id === ROOT_ID || (m.target.closest && m.target.closest('#' + ROOT_ID)))) return;
    queueScan();
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- messages from the toolbar popup / keyboard shortcut ----------
  try {
    api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || !msg.type) return;
      if (msg.type === 'fill') {
        const r = fillNow();
        if (window.top === window || r.filled) toast(r.filled ? `Filled ${r.filled} ${r.filled === 1 ? 'answer' : 'answers'}${r.review ? ` · ${r.review} to check (amber)` : ''}` : 'Nothing new to fill here');
        hidePill();
        sendResponse(r);
      } else if (msg.type === 'count') {
        sendResponse({ fillable: buildPlan().length });
      }
      return true;
    });
  } catch (e) { /* ignore */ }

  // Exposed for testing only.
  window.__applyHelperTest = { scan, fillNow, buildPlan, describe, lookup, get memory() { return memory; } };

  load().then(queueScan);
})();
