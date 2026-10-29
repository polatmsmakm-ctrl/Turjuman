'use strict';
/* Learn tab: flashcards (26), word of the day + morning notification (27), quizzes (28), CEFR level & frequency (29),
   inflections (30), collocations (31), confusable words (32), Arabic dictionary & roots (34), grammar check (35),
   learning stats (37), travel phrasebook (57). */
(function () {
var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, S = A.S, Store = A.Store, Native = A.Native, LANG = A.LANG;
var DAY = 864e5;
function pad(n) { return (n < 10 ? '0' : '') + n; }
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function today0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function isAr(s) { return /[؀-ۿ]/.test(s || ''); }
function arNum(n) { return String(n); }
function closeAllAnd(fn) { Array.prototype.forEach.call(document.querySelectorAll('#screens .screen.in'), function () { A.closeScreen(); }); fn(); }
function openDict(w) { closeAllAnd(function () { A.showView('dict'); A.dictSearch(w); }); }

A.EXTRA_ERR.lt_limit = 'خدمة التدقيق مشغولة الحين. جرّب بعد دقيقة.';
A.EXTRA_ERR.notif_denied = 'التنبيهات مقفلة لترجمان. فعّلها من: الإعدادات ← ترجمان ← الإشعارات.';

/* =========================================================
   37. Stats
   ========================================================= */
var ST = Store.get('stats', { d: {}, best: 0 });
if (!ST.d) ST = { d: {}, best: 0 };
var stT = 0;
function saveStats() {
  clearTimeout(stT);
  stT = setTimeout(function () {
    var keys = Object.keys(ST.d).sort();
    while (keys.length > 120) delete ST.d[keys.shift()];
    ST.best = Math.max(ST.best || 0, streak());
    Store.set('stats', ST);
  }, 400);
}
function dayStats(k) { k = k || dayKey(); return (ST.d[k] = ST.d[k] || {}); }
function bump(f, n) { var d = dayStats(); d[f] = (d[f] || 0) + (n == null ? 1 : n); saveStats(); }
function activity(d) { return d ? (d.tr || 0) + (d.look || 0) + (d.rev || 0) + (d.quiz || 0) + (d.speak || 0) + (d.gram || 0) : 0; }
function streak() {
  var n = 0, d = new Date();
  if (!activity(ST.d[dayKey(d)])) d.setDate(d.getDate() - 1);
  while (activity(ST.d[dayKey(d)])) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
A.learnBump = bump;
A.hookAdd('afterResult', function (r) { if (r && !r.preview) bump('tr'); });
A.hookAdd('afterLookup', function (box, res, word, opts) { if (!opts || !opts.compact) bump('look'); });

/* =========================================================
   29. CEFR level + frequency
   ========================================================= */
var LV = null, FR = null, IRR = null, IRR_FORM = null;
function loadData() {
  if (LV) return;
  LV = new Map(); FR = new Map(); IRR = {}; IRR_FORM = {};
  Object.keys(TJD.cefrRaw).forEach(function (l) { TJD.cefrRaw[l].split('|').forEach(function (w) { if (!LV.has(w)) LV.set(w, l); }); });
  TJD.freqRaw.split(' ').forEach(function (w, i) { if (!FR.has(w)) FR.set(w, i + 1); });
  TJD.irregularVerbs.forEach(function (v) {
    IRR[v[0]] = [v[1], v[2]];
    v[1].split('/').concat(v[2].split('/')).forEach(function (f) { if (!IRR_FORM[f]) IRR_FORM[f] = v[0]; });
  });
  Object.keys(TJD.irregularPlurals).forEach(function (k) { var p = TJD.irregularPlurals[k]; if (!IRR_FORM[p]) IRR_FORM[p] = k; });
  POS = new Map();
  Object.keys(TJD.posRaw || {}).forEach(function (p) { TJD.posRaw[p].split('|').forEach(function (w) { POS.set(w, p); }); });
}
var POS = null;
function posOf(w) { loadData(); return POS.get(w) || ''; }
/* best dictionary form for an inflected word: went→go, studies→study, stopped→stop */
function baseOf(w) {
  loadData();
  w = w.toLowerCase();
  if (LV.has(w) || IRR[w]) return w;
  var ls = lemmas(w);
  for (var i = 1; i < ls.length; i++) if (LV.has(ls[i]) || IRR[ls[i]]) return ls[i];
  return w;
}
function lemmas(w) {
  loadData();
  w = String(w || '').toLowerCase().replace(/’/g, "'");
  var out = [w];
  if (IRR_FORM[w]) out.push(IRR_FORM[w]);
  function add(x) { if (x && x.length > 1) out.push(x); }
  if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ves$/.test(w)) { add(w.slice(0, -3) + 'f'); add(w.slice(0, -3) + 'fe'); }
  if (/es$/.test(w)) add(w.slice(0, -2));
  if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
  if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ed$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); if (/([^aeiou])\1ed$/.test(w)) add(w.slice(0, -3)); }
  if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); if (/([^aeiou])\1ing$/.test(w)) add(w.slice(0, -4)); if (/ying$/.test(w)) add(w.slice(0, -4) + 'ie'); }
  if (/ier$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/iest$/.test(w)) add(w.slice(0, -4) + 'y');
  if (/er$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (/est$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
  if (/ily$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ly$/.test(w)) add(w.slice(0, -2));
  return out;
}
function levelOf(w) {
  loadData();
  var ls = lemmas(w);
  for (var i = 0; i < ls.length; i++) if (LV.has(ls[i])) return { level: LV.get(ls[i]), lemma: ls[i] };
  return null;
}
function rankOf(w) {
  loadData();
  var ls = lemmas(w);
  for (var i = 0; i < ls.length; i++) { var r = FR.get(ls[i]); if (r) return r; }
  return 0;
}
var LV_AR = { A1: 'مبتدئ', A2: 'أساسي', B1: 'متوسط', B2: 'فوق المتوسط', C1: 'متقدم', C2: 'متمكّن' };
var LV_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
function rankText(r) {
  if (!r) return 'كلمة نادرة';
  if (r <= 500) return 'من أشهر 500 كلمة';
  if (r <= 1000) return 'من أشهر 1000 كلمة';
  if (r <= 3000) return 'من أشهر 3000 كلمة';
  if (r <= 5000) return 'من أشهر 5000 كلمة';
  if (r <= 10000) return 'من أشهر 10 آلاف كلمة';
  return 'من أشهر 20 ألف كلمة';
}
function levelHTML(w) {
  if (!/^[A-Za-z][A-Za-z'’\- ]*$/.test(w || '')) return '';
  var lv = /\s/.test(w.trim()) ? null : levelOf(w), r = /\s/.test(w.trim()) ? 0 : rankOf(w);
  if (!lv && !r) return '';
  return '<div class="lvl-line">' + (lv ? '<span class="lv lv-' + lv.level + '" title="' + LV_AR[lv.level] + '">' + lv.level + '</span><span class="lv-name">' + LV_AR[lv.level] + '</span>' : '') +
    '<span class="freq">' + (lv ? '· ' : '') + rankText(r) + '</span></div>';
}

/* =========================================================
   30. Inflections
   ========================================================= */
function vowelGroups(w) { return (w.match(/[aeiouy]+/g) || []).length; }
function doubleFinal(w) { return /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w); }
function verbForms(v) {
  loadData();
  v = v.toLowerCase();
  var irr = IRR[v];
  var s3 = v === 'be' ? 'is' : v === 'have' ? 'has' : /(s|sh|ch|x|z|o)$/.test(v) ? v + 'es' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ies' : v + 's';
  var ing = v === 'be' ? 'being' : /ie$/.test(v) ? v.slice(0, -2) + 'ying' : (/[^aeiou]e$/.test(v) || /[^e]ue$/.test(v)) && !/(ee|ye|oe)$/.test(v) ? v.slice(0, -1) + 'ing' : doubleFinal(v) ? v + v.slice(-1) + 'ing' : v + 'ing';
  var ed = /e$/.test(v) ? v + 'd' : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + 'ied' : doubleFinal(v) ? v + v.slice(-1) + 'ed' : v + 'ed';
  return { base: v, s3: s3, past: irr ? irr[0] : ed, pp: irr ? irr[1] : ed, ing: ing, irregular: !!irr };
}
function pluralOf(n) {
  loadData();
  n = n.toLowerCase();
  if (TJD.irregularPlurals[n]) return { p: TJD.irregularPlurals[n], irregular: true };
  if (TJD.uncountable.indexOf(n) >= 0) return { p: null, uncountable: true };
  if (/(s|sh|ch|x|z)$/.test(n)) return { p: n + 'es' };
  if (/[^aeiou]y$/.test(n)) return { p: n.slice(0, -1) + 'ies' };
  return { p: n + 's' };
}
function comparOf(a) {
  a = a.toLowerCase();
  var irr = TJD.irregularAdj[a];
  if (irr) return { c: irr[0], s: irr[1], irregular: true };
  var g = vowelGroups(a.replace(/e$/, ''));
  if (g >= 3 || (g === 2 && !/y$/.test(a)) || /(ed|ing|ful|ous|ive|less)$/.test(a)) return { c: 'more ' + a, s: 'most ' + a };
  if (/[^aeiou]y$/.test(a)) return { c: a.slice(0, -1) + 'ier', s: a.slice(0, -1) + 'iest' };
  if (/e$/.test(a)) return { c: a + 'r', s: a + 'st' };
  if (doubleFinal(a)) return { c: a + a.slice(-1) + 'er', s: a + a.slice(-1) + 'est' };
  return { c: a + 'er', s: a + 'est' };
}
function fm(w, irr) { return '<b class="fm' + (irr ? ' irr' : '') + '" dir="ltr">' + esc(w) + '</b>'; }
function formsHTML(word, fl) {
  fl = String(fl || '').toLowerCase();
  if (!/^[a-z][a-z\-]*$/i.test(word || '')) return '';
  var h = '';
  if (/verb/.test(fl) && !/adverb/.test(fl)) {
    var f = verbForms(word);
    h = '<span class="fm-l">التصريف</span>' + fm(f.base) + '<i>·</i>' + fm(f.past, f.irregular) + '<i>·</i>' + fm(f.pp, f.irregular) + '<i>·</i>' + fm(f.ing) + '<i>·</i>' + fm(f.s3) +
      (f.irregular ? '<span class="fm-tag">فعل شاذ</span>' : '');
  } else if (/noun/.test(fl)) {
    var p = pluralOf(word);
    if (p.uncountable) h = '<span class="fm-l">الجمع</span><span class="fm-tag">ما ينجمع (uncountable)</span>';
    else if (p.p) h = '<span class="fm-l">الجمع</span>' + fm(p.p, p.irregular) + (p.irregular ? '<span class="fm-tag">جمع شاذ</span>' : '');
  } else if (/adjective/.test(fl)) {
    var c = comparOf(word);
    h = '<span class="fm-l">المقارنة</span>' + fm(c.c, c.irregular) + '<i>·</i>' + fm(c.s, c.irregular);
  }
  return h ? '<div class="forms">' + h + '</div>' : '';
}

/* =========================================================
   26. Flashcards (spaced repetition)
   ========================================================= */
var NEW_PER_DAY = 15;
var CARDS = Store.get('cards', []);
function saveCards() { Store.set('cards', CARDS); refreshLearn(); }
function findCard(w) { w = String(w).trim().toLowerCase(); return CARDS.filter(function (c) { return c.w.toLowerCase() === w; })[0]; }
async function meaningOf(w, sl) {
  sl = sl || (isAr(w) ? 'ar' : 'en');
  var tl = sl === 'ar' ? 'en' : 'ar';
  try {
    var g = await A.googleTranslate(w, sl, tl);
    var words = [];
    (g.dict || []).forEach(function (d) { d.entries.slice(0, 2).forEach(function (e) { if (words.length < 3 && words.indexOf(e.word) < 0) words.push(e.word); }); });
    return words.length ? words.join('، ') : g.text;
  } catch (e) { return ''; }
}
async function addCard(w, m, extra) {
  w = String(w || '').trim();
  if (!w) return null;
  var c0 = findCard(w);
  if (c0) { A.toast('موجودة في بطاقاتك'); return c0; }
  var l = (extra && extra.l) || (isAr(w) ? 'ar' : 'en');
  if (!m) m = await meaningOf(w, l);
  var c = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), w: w, m: m || '', l: l, ex: '', added: Date.now(), due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, n: true }, extra || {});
  CARDS.unshift(c);
  saveCards();
  A.toast('انضافت للبطاقات: ' + w);
  A.haptic();
  return c;
}
function isDue(c, t) { return !c.n && c.due <= (t || Date.now()); }
function dueCount() { var t = Date.now(); return CARDS.filter(function (c) { return isDue(c, t); }).length; }
function newLeft() { return Math.max(0, NEW_PER_DAY - (dayStats().newSeen || 0)); }
function newCount() { return Math.min(newLeft(), CARDS.filter(function (c) { return c.n; }).length); }
function buildQueue() {
  var t = Date.now();
  var due = CARDS.filter(function (c) { return isDue(c, t); }).sort(function (a, b) { return a.due - b.due; });
  var news = CARDS.filter(function (c) { return c.n; }).slice().reverse().slice(0, newLeft());
  return due.concat(news);
}
function schedule(c, g, dry) {
  var x = Object.assign({}, c);
  if (g === 0) { x.lapses = (x.lapses || 0) + 1; x.reps = 0; x.ease = Math.max(1.3, x.ease - 0.2); x.ivl = 0; x.due = Date.now() + 60e3; }
  else {
    if (g === 1) { x.ivl = Math.max(1, Math.round((x.ivl || 1) * 1.2)); x.ease = Math.max(1.3, x.ease - 0.15); }
    else if (g === 2) x.ivl = x.reps === 0 ? 1 : x.reps === 1 ? 3 : Math.max(x.ivl + 1, Math.round(x.ivl * x.ease));
    else { x.ivl = x.reps === 0 ? 4 : Math.max(x.ivl + 2, Math.round(Math.max(x.ivl, 1) * x.ease * 1.3)); x.ease += 0.15; }
    x.reps++; x.due = today0() + x.ivl * DAY;
  }
  if (!dry) { if (c.n) bump('newSeen'); x.n = false; x.last = Date.now(); Object.assign(c, x); bump('rev'); if (g >= 2) bump('revOk'); }
  return x;
}
function ivlText(x) {
  if (!x.ivl) return 'دقيقة';
  var d = x.ivl;
  if (d === 1) return 'بكرة';
  if (d < 7) return d + ' أيام';
  if (d < 30) return Math.round(d / 7) === 1 ? 'أسبوع' : Math.round(d / 7) + ' أسابيع';
  if (d < 365) return Math.round(d / 30) === 1 ? 'شهر' : Math.round(d / 30) + ' شهور';
  return 'سنة+';
}
function dueText(ts) {
  var d = Math.round((ts - today0()) / DAY);
  return d <= 0 ? 'اليوم' : d === 1 ? 'بكرة' : d === 2 ? 'بعد يومين' : d < 11 ? 'بعد ' + d + ' أيام' : 'بعد ' + d + ' يوم';
}
function cardFront(c) {
  var en = c.l !== 'ar';
  return '<div class="fc-w ' + (en ? 'en' : 'ar') + '" dir="' + (en ? 'ltr' : 'rtl') + '">' + esc(c.w) + '</div>' +
    (en ? levelHTML(c.w) + (S.showPron && !/\s/.test(c.w.trim()) ? '<div class="pr-us" data-pron-word="' + esc(c.w) + '"></div>' : '') : '');
}
function reviewScreen() {
  var queue = buildQueue();
  var sc = A.openScreen({ title: 'مراجعة البطاقات', onClose: refreshLearn });
  var done = 0, total = queue.length, right = 0;
  function show() {
    var c = queue[0];
    if (!c) {
      sc.body.innerHTML = '<div class="empty"><div class="big">' + (total ? 'أحسنت! خلصت مراجعة اليوم' : 'ما فيه بطاقات للمراجعة الحين') + '</div>' +
        (total ? 'راجعت ' + done + ' بطاقة، وعرفت ' + right + ' منها.' : 'أضف كلمات من القاموس أو من الترجمة (زر «أدوات الترجمة») وترجع لك هنا بالوقت المناسب.') + '</div>' +
        '<div class="ph-acts" style="justify-content:center"><button type="button" class="pbtn" data-act="lr-close">' + icon('check') + '<span>تم</span></button>' +
        '<button type="button" class="pbtn" data-act="lr-quiz">' + icon('quiz') + '<span>اختبر نفسك</span></button></div>';
      return;
    }
    var en = c.l !== 'ar';
    sc.body.innerHTML = '<div class="fc-prog"><div class="bt-bar"><i style="width:' + Math.round(100 * done / Math.max(1, total)) + '%"></i></div><span>' + (queue.length) + ' باقية</span></div>' +
      '<div class="fc" id="fc"><div class="fc-front">' + cardFront(c) +
      '<button type="button" class="ic fc-say" data-act="fc-say" aria-label="استمع">' + icon('speaker') + '</button></div>' +
      '<div class="fc-back" hidden><div class="fc-m" dir="auto">' + esc(c.m || '—') + '</div>' + (c.ex ? '<div class="fc-ex" dir="auto">' + esc(c.ex) + '</div>' : '') + '</div></div>' +
      '<div class="fc-acts" id="fcActs"><button type="button" class="fc-show" data-act="fc-show">اعرض المعنى</button></div>';
    A.fillPron(sc.body);
    if (S.autoSpeak && en) A.speak(c.w, c.l);
  }
  A.ACTIONS['fc-say'] = function () { var c = queue[0]; if (c) A.speak(c.w, c.l); };
  A.ACTIONS['fc-show'] = function () {
    var c = queue[0]; if (!c) return;
    $('.fc-back', sc.body).hidden = false;
    var labels = ['ما عرفتها', 'صعبة', 'عرفتها', 'سهلة'];
    $('#fcActs', sc.body).innerHTML = '<div class="fc-grades">' + labels.map(function (l, g) {
      return '<button type="button" class="fc-g g' + g + '" data-act="fc-grade" data-g="' + g + '"><b>' + l + '</b><small>' + ivlText(schedule(c, g, true)) + '</small></button>';
    }).join('') + '</div>';
  };
  A.ACTIONS['fc-grade'] = function (b) {
    var c = queue.shift(); if (!c) return;
    var g = +b.getAttribute('data-g');
    schedule(c, g);
    if (g === 0) queue.splice(Math.min(3, queue.length), 0, c); else { done++; if (g >= 2) right++; }
    Store.set('cards', CARDS);
    A.haptic();
    show();
  };
  A.ACTIONS['lr-close'] = function () { A.closeScreen(sc); };
  A.ACTIONS['lr-quiz'] = function () { A.closeScreen(sc); quizScreen(); };
  show();
}
function cardsScreen() {
  var sc = A.openScreen({ title: 'بطاقاتي', onClose: refreshLearn });
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="cd-new" aria-label="بطاقة جديدة">' + icon('pen') + '</button>' +
    (A.exportCards ? '<button type="button" class="ic" data-act="cd-export" aria-label="تصدير">' + icon('share') + '</button>' : '');
  sc.body.innerHTML = '<div class="url-form"><input id="cdQ" type="search" dir="auto" placeholder="ابحث في بطاقاتك"></div>' +
    '<div class="ph-acts"><button type="button" class="pbtn" data-act="cd-fav">' + icon('star') + '<span>أضف من المفضلة</span></button></div><div id="cdList"></div>';
  function draw() {
    var q = $('#cdQ', sc.body).value.trim().toLowerCase(), t = Date.now();
    var list = CARDS.filter(function (c) { return !q || c.w.toLowerCase().indexOf(q) >= 0 || (c.m || '').indexOf(q) >= 0; });
    $('#cdList', sc.body).innerHTML = list.length ? '<ul class="hist">' + list.slice(0, 400).map(function (c) {
      var st = c.n ? 'جديدة' : isDue(c, t) ? 'تستحق المراجعة' : 'المراجعة ' + dueText(c.due);
      return '<li><div class="h-main"><div class="h-tr ' + (c.l === 'ar' ? 'ar' : 'en') + '" dir="auto">' + esc(c.w) + '</div><div class="h-src" dir="auto">' + esc(c.m) + '</div><div class="h-meta">' + st + (c.ivl >= 21 ? ' · محفوظة ✓' : '') + '</div></div>' +
        '<button type="button" class="ic" data-act="cd-say" data-id="' + c.id + '" aria-label="استمع">' + icon('speaker') + '</button>' +
        '<button type="button" class="ic" data-act="cd-del" data-id="' + c.id + '" aria-label="حذف">' + icon('trash') + '</button></li>';
    }).join('') + '</ul>' : '<div class="empty">' + (CARDS.length ? 'ما فيه نتائج' : '<div class="big">ما عندك بطاقات للحين</div>أضف كلمات من القاموس بزر «+ بطاقة»، أو من «أدوات الترجمة»، أو من المفضلة.') + '</div>';
  }
  $('#cdQ', sc.body).addEventListener('input', draw);
  A.ACTIONS['cd-del'] = function (b) { CARDS = CARDS.filter(function (c) { return c.id !== b.getAttribute('data-id'); }); Store.set('cards', CARDS); draw(); };
  A.ACTIONS['cd-say'] = function (b) { var c = CARDS.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0]; if (c) A.speak(c.w, c.l); };
  A.ACTIONS['cd-fav'] = async function () {
    var favs = A.getHistory().filter(function (h) { return h.fav; }), n = 0;
    for (var i = 0; i < favs.length; i++) {
      var h = favs[i], w, m, l;
      if (h.sl === 'ar') { w = h.t; m = h.s; l = h.tl; } else { w = h.s; m = h.tl === 'ar' ? h.t : ''; l = h.sl; }
      if (!w || w.length > 80 || findCard(w)) continue;
      CARDS.unshift({ id: Date.now().toString(36) + i, w: w.trim(), m: m || h.t, l: l, ex: '', added: Date.now(), due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, n: true });
      n++;
    }
    Store.set('cards', CARDS); draw();
    A.toast(n ? 'انضافت ' + n + ' بطاقة من المفضلة' : 'ما فيه مفضلة جديدة تنضاف');
  };
  A.ACTIONS['cd-new'] = function () {
    A.openModal('<h3>بطاقة جديدة</h3><div class="panel"><div class="field"><div class="f-label"><span>الكلمة أو العبارة</span></div><input id="cdW" type="text" dir="auto" autocapitalize="off"></div>' +
      '<div class="field"><div class="f-label"><span>المعنى (اتركه فاضي ويترجمه)</span></div><input id="cdM" type="text" dir="auto"></div></div>' +
      '<div class="actions"><button type="button" class="primary ok" data-act="cd-new-ok">أضف</button><button type="button" data-close>إلغاء</button></div>');
    setTimeout(function () { $('#cdW').focus(); }, 200);
  };
  A.ACTIONS['cd-new-ok'] = async function () { var w = $('#cdW').value.trim(), m = $('#cdM').value.trim(); A.closeModal(); if (w) { await addCard(w, m); draw(); } };
  A.ACTIONS['cd-export'] = function () { if (A.exportCards) A.exportCards(); };
  draw();
}

/* add-card entry points */
A.ACTIONS['card-add'] = function (b) {
  var w = b.getAttribute('data-w'), ex = b.getAttribute('data-ex') || '';
  addCard(w, '', { ex: ex }).then(function () { b.classList.add('is-on'); b.innerHTML = icon('check') + '<span>في البطاقات</span>'; });
};
A.addResultAction({ id: 'card', label: 'أضف للبطاقات', sub: 'تراجعها لاحقًا بالتكرار المتباعد', icon: 'cards', order: 16,
  when: function (r) { return r.source.length <= 120; },
  run: function (r) {
    if (r.sl === 'ar') addCard(r.text, r.source, { l: r.tl });
    else addCard(r.source, r.tl === 'ar' ? r.text : '', { l: r.sl });
  } });

/* dictionary entry extras: level, forms, add-card, confusables, collocations */
A.hookAdd('afterLookup', function (box, res, word, opts) {
  opts = opts || {};
  var list = opts.compact ? res.entries.slice(0, 2) : res.entries;
  var arts = $$('article.entry', box);
  arts.forEach(function (art, i) {
    var e = list[i]; if (!e) return;
    var hw = (e.base || e.hw || '').replace(/[·*]/g, '');
    var head = $('.entry-head', art); if (!head) return;
    var extra = levelHTML(hw) + formsHTML(hw, e.fl);
    if (i === 0) {
      var exEl = $('.ex-en', art);
      extra += '<div class="ent-acts"><button type="button" class="pbtn' + (findCard(hw) ? ' is-on' : '') + '" data-act="card-add" data-w="' + esc(hw) + '" data-ex="' + esc(exEl ? exEl.textContent : '') + '">' +
        icon(findCard(hw) ? 'check' : 'cards') + '<span>' + (findCard(hw) ? 'في البطاقات' : 'أضف للبطاقات') + '</span></button></div>';
    }
    if (extra) head.insertAdjacentHTML('beforeend', extra);
  });
  var conf = confusableFor(word);
  if (conf && arts[0]) arts[0].insertAdjacentHTML('afterend', confHTML(conf, word));
  if (!opts.compact && /^[A-Za-z][A-Za-z\-]+$/.test(word) && arts.length) {
    var slot = document.createElement('div');
    slot.className = 'syn-row colloc';
    arts[arts.length - 1].after(slot);
    collocations(word).then(function (c) {
      var all = c.before.slice(0, 4).concat(c.adj.slice(0, 4), c.after.slice(0, 4), c.nouns.slice(0, 3));
      if (!all.length) { slot.remove(); return; }
      slot.innerHTML = '<div class="lbl">كلمات تجي معها <button type="button" class="link-btn" data-act="colloc-open" data-w="' + esc(word) + '">الكل</button></div><div class="chips" dir="ltr">' +
        all.map(function (p) { return '<button type="button" class="chip en" data-act="colloc-tr" data-p="' + esc(p) + '">' + esc(p) + '</button>'; }).join('') + '</div>';
    }).catch(function () { slot.remove(); });
  }
});

/* =========================================================
   31. Collocations (Datamuse, free; Claude for explanations)
   ========================================================= */
var STOP = new Set('the a an of to and in is was for on that it with as be this by at his her my your their our its from or but not are were been has have had will would can could should i you he she we they me him them us what which who whom there here than then so if no do does did just very also about into over up out more most some any all one two'.split(' '));
var colCache = new Map();
async function collocations(word) {
  word = word.toLowerCase();
  if (colCache.has(word)) return colCache.get(word);
  var w = encodeURIComponent(word);
  var qs = ['rel_jjb=' + w, 'rc=' + w, 'lc=' + w, 'rel_jja=' + w];
  var res = await Promise.all(qs.map(function (q) {
    return A.http('https://api.datamuse.com/words?max=25&' + q, { timeout: 12 }).then(function (r) {
      if (r.status >= 400) return [];
      try { return JSON.parse(r.body) || []; } catch (e) { return []; }
    }).catch(function () { return []; });
  }));
  function ok(x) { return x && /^[a-z][a-z\-']*$/.test(x.word) && !STOP.has(x.word) && x.word !== word; }
  var out = {
    adj: res[0].filter(ok).slice(0, 10).map(function (x) { return x.word + ' ' + word; }),
    before: res[1].filter(ok).slice(0, 10).map(function (x) { return x.word + ' ' + word; }),
    after: res[2].filter(ok).slice(0, 10).map(function (x) { return word + ' ' + x.word; }),
    nouns: res[3].filter(ok).slice(0, 10).map(function (x) { return word + ' ' + x.word; })
  };
  // remove duplicates across groups
  var seen = new Set();
  Object.keys(out).forEach(function (k) { out[k] = out[k].filter(function (p) { if (seen.has(p)) return false; seen.add(p); return true; }); });
  colCache.set(word, out);
  return out;
}
A.ACTIONS['colloc-tr'] = function (b) {
  var p = b.getAttribute('data-p');
  closeAllAnd(function () { A.showView('translate'); A.srcEl.value = p; A.T.sessionId = null; A.onInput(); });
};
A.ACTIONS['colloc-open'] = function (b) { collocScreen(b.getAttribute('data-w')); };
function collocScreen(prefill) {
  var sc = A.openScreen({ title: 'التلازم اللفظي' });
  sc.body.innerHTML = '<p class="scr-hint">الكلمات اللي تجي مع بعض عادةً بالإنجليزي (مثل <b dir="ltr">make a decision</b> مو <span dir="ltr">do a decision</span>). اكتب كلمة إنجليزية.</p>' +
    '<form class="url-form" id="coForm"><input id="coIn" type="text" dir="ltr" autocapitalize="off" autocorrect="off" placeholder="decision" value="' + esc(prefill || '') + '"><button type="submit" class="pbtn">اعرض</button></form><div id="coBody"></div>';
  var body = $('#coBody', sc.body);
  async function run() {
    var w = $('#coIn', sc.body).value.trim().toLowerCase();
    if (!/^[a-z][a-z\-]*$/.test(w)) { A.toast('اكتب كلمة إنجليزية وحدة'); return; }
    body.innerHTML = '<div class="empty">جاري البحث…</div>';
    try {
      var c = await collocations(w);
      var groups = [['before', 'كلمات تجي قبلها'], ['adj', 'صفات توصفها'], ['after', 'كلمات تجي بعدها'], ['nouns', 'أسماء توصفها']];
      var all = [];
      groups.forEach(function (g) { all = all.concat(c[g[0]]); });
      if (!all.length) { body.innerHTML = '<div class="empty">ما لقيت كلمات متلازمة لهذي الكلمة.</div>'; return; }
      body.innerHTML = groups.filter(function (g) { return c[g[0]].length; }).map(function (g) {
        return '<div class="block-h"><span>' + g[1] + '</span></div><div class="co-list">' + c[g[0]].map(function (p) {
          return '<button type="button" class="co-row" data-act="say-text" data-say="' + esc(p) + '"><span class="co-en" dir="ltr">' + esc(p) + '</span><span class="co-ar" data-p="' + esc(p) + '"></span></button>';
        }).join('') + '</div>';
      }).join('') + (A.engineReady('claude') ? '<div class="ph-acts" style="margin-top:12px"><button type="button" class="pbtn" data-act="co-claude" data-w="' + esc(w) + '">' + icon('bulb') + '<span>اشرحها لي مع أمثلة (Claude)</span></button></div><div id="coClaude"></div>' : '');
      var tr = await A.translateMany(all, 'en', 'ar');
      all.forEach(function (p, i) { var el = $('.co-ar[data-p="' + CSS.escape(p) + '"]', body); if (el) el.textContent = tr[i] || ''; });
    } catch (e) { body.innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; }
  }
  $('#coForm', sc.body).addEventListener('submit', function (e) { e.preventDefault(); run(); });
  A.ACTIONS['co-claude'] = function (b) {
    var box = $('#coClaude', sc.body), w = b.getAttribute('data-w');
    box.innerHTML = '<div class="empty">جاري الشرح…</div>';
    A.claudeCall('You are an English teacher for Arabic speakers. For the English word in the user message, list its 10 most useful collocations ' +
      '(verb+noun, adjective+noun, noun+preposition, fixed phrases). For each: the collocation in English, its natural Arabic meaning, and one short English example sentence. ' +
      'Also add one line warning about a common wrong collocation Arabic speakers make with this word, if any. Format each item as: "• collocation — المعنى\\n  Example." Answer in Arabic except the English parts. No intro.', w, 1600)
      .then(function (out) { box.innerHTML = '<div class="extra-card"><div class="explain" dir="rtl">' + esc(out).replace(/\n/g, '<br>') + '</div></div>'; })
      .catch(function (e) { box.innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; });
  };
  if (prefill) run(); else setTimeout(function () { $('#coIn', sc.body).focus(); }, 300);
}

/* =========================================================
   32. Confusable words
   ========================================================= */
var CONF_INDEX = null;
function confIndex() {
  if (CONF_INDEX) return CONF_INDEX;
  CONF_INDEX = {};
  TJD.confusables.forEach(function (c, i) { c[0].forEach(function (w) { CONF_INDEX[w.toLowerCase()] = i; }); });
  return CONF_INDEX;
}
function confusableFor(word) {
  var idx = confIndex(), w = String(word || '').toLowerCase().trim();
  if (idx[w] != null) return TJD.confusables[idx[w]];
  var ls = lemmas(w);
  for (var i = 0; i < ls.length; i++) if (idx[ls[i]] != null && ls[i].length > 2) return TJD.confusables[idx[ls[i]]];
  return null;
}
function confHTML(c, word) {
  return '<div class="conf-box"><div class="conf-h">' + icon('bulb') + '<span>انتبه لا تخلط بين: </span><b dir="ltr">' + c[0].map(esc).join(' / ') + '</b></div>' +
    '<div class="conf-t">' + esc(c[1]) + '</div><div class="conf-ex" dir="ltr">' + c[2].map(function (x) {
      return '<button type="button" data-act="say-text" data-say="' + esc(x) + '">' + esc(x) + '</button>';
    }).join('') + '</div></div>';
}
function confScreen() {
  var sc = A.openScreen({ title: 'كلمات تتلخبط' });
  sc.body.innerHTML = '<p class="scr-hint">كلمات إنجليزية يخلط بينها المتحدثين بالعربي كثير. اضغط أي مثال تسمعه.</p>' +
    '<div class="url-form"><input id="cfQ" type="search" dir="auto" placeholder="ابحث: affect"></div><div id="cfList"></div>';
  function draw() {
    var q = $('#cfQ', sc.body).value.trim().toLowerCase();
    $('#cfList', sc.body).innerHTML = TJD.confusables.filter(function (c) { return !q || c[0].join(' ').toLowerCase().indexOf(q) >= 0 || c[1].indexOf(q) >= 0; })
      .map(function (c) { return confHTML(c); }).join('') || '<div class="empty">ما فيه نتائج</div>';
  }
  $('#cfQ', sc.body).addEventListener('input', draw);
  draw();
}
/* hint under a translation when the English side has a confusable word */
A.hookAdd('afterResult', function (r) {
  var box = $('#hints'); if (!box) return;
  var en = r.sl === 'en' ? r.source : r.tl === 'en' ? r.text : '';
  var found = [];
  if (en && en.length < 600) {
    var seen = {};
    (en.toLowerCase().match(/[a-z']+(?:\s(?:ready|day))?/g) || []).forEach(function (t) {
      var c = confusableFor(t);
      if (c && !seen[c[0][0]] && t.length > 2) { seen[c[0][0]] = 1; found.push(c); }
    });
  }
  if (!found.length || !S.confHints) { box.hidden = true; box.innerHTML = ''; return; }
  box.innerHTML = found.slice(0, 2).map(function (c) { return confHTML(c); }).join('');
  box.hidden = false;
});
A.hookAdd('renderOutput', function (r) { if (!r) { ['#hints', '#idioms'].forEach(function (s) { var b = $(s); if (b) { b.hidden = true; b.innerHTML = ''; } }); } });
if (S.confHints == null) S.confHints = true;

/* =========================================================
   29b. CEFR level browser + text level analyzer
   ========================================================= */
function levelsScreen(start) {
  loadData();
  var lv = start || S.lvSel || 'B1', limit = 300;
  var sc = A.openScreen({ title: 'الكلمات حسب المستوى' });
  sc.body.innerHTML = '<p class="scr-hint">مستويات الإطار الأوروبي (CEFR): من A1 للمبتدئ إلى C2 للمتمكّن. اضغط أي كلمة تسمعها أو تضيفها للبطاقات.</p>' +
    '<div class="seg lv-seg" id="lvSeg">' + LV_ORDER.map(function (l) { return '<button type="button" data-l="' + l + '"' + (l === lv ? ' class="is-on"' : '') + '>' + l + '</button>'; }).join('') + '</div>' +
    '<div class="lv-desc" id="lvDesc"></div><div class="url-form"><input id="lvQ" type="search" dir="ltr" autocapitalize="off" placeholder="search"></div><div id="lvList" class="chips" dir="ltr"></div><div id="lvMore"></div>';
  function words() { return TJD.cefrRaw[lv].split('|'); }
  function draw() {
    var q = $('#lvQ', sc.body).value.trim().toLowerCase();
    var ws = words().filter(function (w) { return !q || w.indexOf(q) === 0; });
    $('#lvDesc', sc.body).innerHTML = '<span class="lv lv-' + lv + '">' + lv + '</span> ' + LV_AR[lv] + ' · ' + words().length + ' كلمة' +
      ' · <button type="button" class="link-btn" data-act="lv-quiz">اختبرني فيها</button>';
    $('#lvList', sc.body).innerHTML = ws.slice(0, limit).map(function (w) { return '<button type="button" class="chip en" data-act="lv-word" data-w="' + esc(w) + '">' + esc(w) + '</button>'; }).join('');
    $('#lvMore', sc.body).innerHTML = ws.length > limit ? '<div class="ph-acts" style="justify-content:center;margin-top:12px"><button type="button" class="pbtn" data-act="lv-more">المزيد (' + (ws.length - limit) + ')</button></div>' : '';
  }
  $('#lvSeg', sc.body).addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    lv = b.getAttribute('data-l'); S.lvSel = lv; A.saveSettings(); limit = 300;
    $$('#lvSeg button', sc.body).forEach(function (x) { x.classList.toggle('is-on', x === b); });
    draw();
  });
  $('#lvQ', sc.body).addEventListener('input', function () { limit = 300; draw(); });
  A.ACTIONS['lv-more'] = function () { limit += 400; draw(); };
  A.ACTIONS['lv-quiz'] = function () { quizScreen({ src: 'level', level: lv }); };
  draw();
}
A.ACTIONS['lv-word'] = function (b) {
  var w = b.getAttribute('data-w');
  A.speak(w, 'en');
  A.openModal('<h3 dir="ltr" style="text-align:left;font-family:var(--serif-en);font-size:26px">' + esc(w) + '</h3>' + levelHTML(w) +
    '<div class="lv-m" id="lvM">…</div><div class="actions three"><button type="button" data-act="say-text" data-say="' + esc(w) + '">استمع</button>' +
    '<button type="button" data-act="lv-dict" data-w="' + esc(w) + '">القاموس</button><button type="button" class="primary ok" data-act="lv-card" data-w="' + esc(w) + '">' + (findCard(w) ? 'في البطاقات ✓' : '+ بطاقة') + '</button></div>');
  meaningOf(w, 'en').then(function (m) { var el = $('#lvM'); if (el) el.textContent = m; });
};
A.ACTIONS['lv-dict'] = function (b) { A.closeModal(); openDict(b.getAttribute('data-w')); };
A.ACTIONS['lv-card'] = function (b) { var w = b.getAttribute('data-w'), m = ($('#lvM') || {}).textContent; A.closeModal(); addCard(w, m && m !== '…' ? m : ''); };

function analyzeLevel(text) {
  loadData();
  var toks = (String(text).toLowerCase().match(/[a-z][a-z']*/g) || []).filter(function (t) { return t.length > 1 || t === 'a' || t === 'i'; });
  var counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, '?': 0 }, hard = {};
  toks.forEach(function (t) {
    var l = levelOf(t), r = rankOf(t);
    var k = l ? l.level : (r && r <= 2000 ? 'A2' : r && r <= 5000 ? 'B2' : '?');
    counts[k]++;
    if ((k === 'C1' || k === 'C2' || k === 'B2' || k === '?') && t.length > 3 && !STOP.has(t)) hard[l ? l.lemma : t] = k;
  });
  var n = toks.length || 1, acc = 0, est = 'C2';
  for (var i = 0; i < LV_ORDER.length; i++) { acc += counts[LV_ORDER[i]]; if (acc / n >= 0.95) { est = LV_ORDER[i]; break; } }
  return { counts: counts, total: toks.length, est: est, hard: hard };
}
A.addResultAction({ id: 'level', label: 'مستوى صعوبة النص', sub: 'كم مستواه (A1–C2) والكلمات الصعبة فيه', icon: 'chart', order: 18,
  when: function (r) { return (r.sl === 'en' || r.tl === 'en') && /\s/.test((r.sl === 'en' ? r.source : r.text).trim()); },
  run: function (r) {
    var en = r.sl === 'en' ? r.source : r.text, a = analyzeLevel(en);
    var bars = LV_ORDER.concat(['?']).map(function (l) {
      var p = Math.round(100 * a.counts[l] / Math.max(1, a.total));
      return '<div class="lvb"><span class="lv lv-' + (l === '?' ? 'x' : l) + '">' + (l === '?' ? '؟' : l) + '</span><div class="bt-bar"><i style="width:' + p + '%"></i></div><b>' + p + '٪</b></div>';
    }).join('');
    var hard = Object.keys(a.hard);
    A.showExtra('مستوى النص', '<div class="lv-est">مستوى النص تقريبًا: <span class="lv lv-' + a.est + '">' + a.est + '</span> ' + LV_AR[a.est] + '</div>' + bars +
      (hard.length ? '<div class="bt-label" style="margin-top:12px">كلمات صعبة في النص</div><div class="chips" dir="ltr">' + hard.slice(0, 30).map(function (w) {
        return '<button type="button" class="chip en" data-act="lv-word" data-w="' + esc(w) + '">' + esc(w) + '</button>';
      }).join('') + '</div>' : ''));
  } });

/* =========================================================
   30b. Irregular verbs + conjugator screen
   ========================================================= */
function irregularScreen() {
  loadData();
  var sc = A.openScreen({ title: 'التصريف والأفعال الشاذة' });
  sc.body.innerHTML = '<div class="extra-card" style="margin-bottom:14px"><div class="f-label" style="font-size:13px;color:var(--ink-2);margin-bottom:6px">صرّف أي كلمة إنجليزية</div>' +
    '<form class="url-form" id="cjForm" style="margin:0"><input id="cjIn" type="text" dir="ltr" autocapitalize="off" autocorrect="off" placeholder="write, child, happy"><button type="submit" class="pbtn">صرّف</button></form><div id="cjOut"></div></div>' +
    '<div class="block-h"><span>الأفعال الشاذة (' + TJD.irregularVerbs.length + ')</span><button type="button" class="link-btn" data-act="irr-quiz">اختبرني</button></div>' +
    '<div class="url-form"><input id="irQ" type="search" dir="ltr" autocapitalize="off" placeholder="search"></div>' +
    '<div class="irr-head" dir="ltr"><span>Base</span><span>Past</span><span>Past participle</span></div><div id="irList"></div>';
  var arMeans = Store.get('irrAr', null);
  function draw() {
    var q = $('#irQ', sc.body).value.trim().toLowerCase();
    $('#irList', sc.body).innerHTML = TJD.irregularVerbs.map(function (v, i) { return [v, i]; }).filter(function (x) { return !q || x[0].join(' ').indexOf(q) >= 0 || (arMeans && (arMeans[x[1]] || '').indexOf(q) >= 0); })
      .map(function (x) {
        var v = x[0];
        return '<button type="button" class="irr-row" data-act="say-text" data-say="' + esc(v[0] + ', ' + v[1].replace('/', ' or ') + ', ' + v[2].replace('/', ' or ')) + '">' +
          '<span class="irr-v" dir="ltr"><b>' + esc(v[0]) + '</b><span>' + esc(v[1]) + '</span><span>' + esc(v[2]) + '</span></span>' +
          '<span class="irr-ar">' + esc(arMeans ? arMeans[x[1]] || '' : '') + '</span></button>';
      }).join('');
  }
  $('#irQ', sc.body).addEventListener('input', draw);
  $('#cjForm', sc.body).addEventListener('submit', function (e) {
    e.preventDefault();
    var w = $('#cjIn', sc.body).value.trim().toLowerCase();
    if (!/^[a-z][a-z\-]*$/.test(w)) return;
    var base = baseOf(w), ps = posOf(base);
    if (!ps) ps = IRR[base] ? 'v' : 'vnj';
    var known = !!posOf(base) || !!IRR[base];
    var v = verbForms(base), p = pluralOf(base), c = comparOf(base), h = '';
    if (ps.indexOf('v') >= 0) h += '<div class="cj-g"><div class="bt-label">' + (known ? 'فعل' : 'لو كانت فعل') + '</div><div class="forms">' + fm(v.base) + '<i>·</i>' + fm(v.past, v.irregular) + '<i>·</i>' + fm(v.pp, v.irregular) + '<i>·</i>' + fm(v.ing) + '<i>·</i>' + fm(v.s3) +
      (v.irregular ? '<span class="fm-tag">فعل شاذ</span>' : '') + '</div><div class="cj-x" dir="ltr">I ' + esc(v.past.split('/')[0]) + ' · I have ' + esc(v.pp.split('/')[0]) + ' · I am ' + esc(v.ing) + ' · she ' + esc(v.s3) + '</div></div>';
    if (ps.indexOf('n') >= 0) h += '<div class="cj-g"><div class="bt-label">' + (known ? 'اسم (الجمع)' : 'لو كانت اسم (الجمع)') + '</div><div class="forms">' + (p.uncountable ? '<span class="fm-tag">ما ينجمع (uncountable)</span>' : fm(p.p, p.irregular) + (p.irregular ? '<span class="fm-tag">جمع شاذ</span>' : '')) + '</div></div>';
    if (ps.indexOf('j') >= 0) h += '<div class="cj-g"><div class="bt-label">' + (known ? 'صفة (المقارنة والتفضيل)' : 'لو كانت صفة (المقارنة والتفضيل)') + '</div><div class="forms">' + fm(c.c, c.irregular) + '<i>·</i>' + fm(c.s, c.irregular) + '</div></div>';
    if (!h) h = '<div class="cj-g"><div class="scr-hint" style="margin:0">«' + esc(base) + '» ' + (ps === 'r' ? 'ظرف (adverb)، ما له تصريف.' : 'ما لها تصريف.') + '</div></div>';
    $('#cjOut', sc.body).innerHTML = '<div class="cj">' + h + (base !== w ? '<div class="scr-hint" style="margin:8px 0 0">«' + esc(w) + '» تصريف من «' + esc(base) + '».</div>' : '') + '</div>';
  });
  A.ACTIONS['irr-quiz'] = function () { quizScreen({ src: 'irr' }); };
  draw();
  if (!arMeans) {
    A.translateMany(TJD.irregularVerbs.map(function (v) { return 'to ' + v[0]; }), 'en', 'ar').then(function (out) {
      arMeans = out.map(function (t) { return String(t || '').replace(/^أن\s+/, ''); }); Store.set('irrAr', arMeans); draw();
    }).catch(function () {});
  }
}

/* =========================================================
   28. Quizzes
   ========================================================= */
function quizScreen(cfg) {
  cfg = cfg || {};
  var sc = A.openScreen({ title: 'اختبار' });
  function setup() {
    var nCards = CARDS.length;
    sc.body.innerHTML = '<p class="scr-hint">اختر وش تبي تختبر نفسك فيه. 10 أسئلة، وأخطاءك تقدر تضيفها للبطاقات.</p><div class="panel">' +
      (nCards >= 4 ? row('cards', 'cards', 'بطاقاتي', nCards + ' كلمة: المعنى، والعكس، والاستماع') : '') +
      LV_ORDER.map(function (l) { return row('level', 'chart', 'كلمات مستوى ' + l, LV_AR[l], l); }).join('') +
      row('irr', 'repeat', 'الأفعال الشاذة', 'go → went → gone') +
      row('conf', 'bulb', 'كلمات تتلخبط', 'affect أو effect؟') +
      row('listen', 'speaker', 'استماع', 'تسمع الكلمة وتختار كتابتها') + '</div>';
  }
  function row(src, ic, t, sub, lv) {
    return '<div class="row choice" data-act="qz-start" data-src="' + src + '"' + (lv ? ' data-l="' + lv + '"' : '') + '><span class="ra-ic">' + icon(ic) + '</span><div class="r-main"><div class="r-title">' + esc(t) + '</div><div class="r-sub" dir="auto">' + esc(sub) + '</div></div></div>';
  }
  A.ACTIONS['qz-start'] = function (b) { start({ src: b.getAttribute('data-src'), level: b.getAttribute('data-l') }); };

  var Q = [], qi = 0, score = 0, wrong = [];
  async function start(c) {
    sc.body.innerHTML = '<div class="empty">جاري تجهيز الأسئلة…</div>';
    try { Q = await buildQuiz(c); } catch (e) { sc.body.innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; return; }
    if (!Q.length) { sc.body.innerHTML = '<div class="empty">ما قدرت أجهز أسئلة. أضف بطاقات أكثر أو جرّب نوع ثاني.</div>'; return; }
    qi = 0; score = 0; wrong = [];
    ask();
  }
  function ask() {
    var q = Q[qi];
    if (!q) { finish(); return; }
    sc.body.innerHTML = '<div class="fc-prog"><div class="bt-bar"><i style="width:' + Math.round(100 * qi / Q.length) + '%"></i></div><span>' + (qi + 1) + ' / ' + Q.length + '</span></div>' +
      '<div class="qz-q">' + q.prompt + (q.say ? '<button type="button" class="ic qz-say" data-act="qz-say" aria-label="استمع">' + icon('speaker') + '</button>' : '') + '</div>' +
      '<div class="qz-opts">' + q.opts.map(function (o, i) {
        return '<button type="button" class="qz-o ' + (isAr(o) ? 'ar' : 'en') + '" data-act="qz-pick" data-i="' + i + '" dir="auto">' + esc(o) + '</button>';
      }).join('') + '</div><div id="qzFb"></div>';
    if (q.say) A.speak(q.say, 'en');
  }
  A.ACTIONS['qz-say'] = function () { var q = Q[qi]; if (q && q.say) A.speak(q.say, 'en', 0.85); };
  A.ACTIONS['qz-pick'] = function (b) {
    var q = Q[qi]; if (!q || q.done) return;
    q.done = true;
    var i = +b.getAttribute('data-i'), ok = q.opts[i] === q.answer;
    $$('.qz-o', sc.body).forEach(function (x) {
      var o = q.opts[+x.getAttribute('data-i')];
      if (o === q.answer) x.classList.add('ok'); else if (x === b) x.classList.add('bad');
      x.disabled = true;
    });
    if (ok) score++; else wrong.push(q);
    Native.call('haptic', { style: ok ? 'success' : 'error' }).catch(function () {});
    bump('quiz'); if (ok) bump('quizOk');
    $('#qzFb', sc.body).innerHTML = (q.explain ? '<div class="conf-t qz-exp">' + esc(q.explain) + '</div>' : '') +
      '<div class="fc-acts"><button type="button" class="fc-show" data-act="qz-next">' + (qi + 1 < Q.length ? 'التالي' : 'النتيجة') + '</button></div>';
  };
  A.ACTIONS['qz-next'] = function () { qi++; ask(); };
  function finish() {
    var pct = Math.round(100 * score / Q.length);
    sc.body.innerHTML = '<div class="qz-res"><div class="qz-score">' + score + ' / ' + Q.length + '</div><div class="qz-msg">' +
      (pct >= 90 ? 'ممتاز! 🌟' : pct >= 70 ? 'زين جدًا 👏' : pct >= 50 ? 'مو بطال، كمّل تمرين' : 'تحتاج مراجعة، لا تستسلم') + '</div></div>' +
      (wrong.length ? '<div class="block-h"><span>أخطاءك</span></div><div class="panel">' + wrong.map(function (q) {
        return '<div class="row"><div class="r-main"><div class="r-title" dir="auto">' + esc(q.card ? q.card.w : q.answer) + '</div><div class="r-sub" dir="auto">' + esc(q.card ? q.card.m : q.explain || '') + '</div></div></div>';
      }).join('') + '</div>' : '') +
      '<div class="ph-acts" style="justify-content:center;margin-top:16px">' +
      (wrong.some(function (q) { return q.card && !findCard(q.card.w); }) ? '<button type="button" class="pbtn" data-act="qz-addwrong">' + icon('cards') + '<span>أضف الأخطاء للبطاقات</span></button>' : '') +
      '<button type="button" class="pbtn" data-act="qz-again">' + icon('repeat') + '<span>اختبار ثاني</span></button></div>';
  }
  A.ACTIONS['qz-again'] = function () { setup(); };
  A.ACTIONS['qz-addwrong'] = function (b) {
    wrong.forEach(function (q) { if (q.card && !findCard(q.card.w)) CARDS.unshift(Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ex: '', added: Date.now(), due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, n: true, l: 'en' }, { w: q.card.w, m: q.card.m })); });
    saveCards(); b.remove(); A.toast('انضافت للبطاقات');
  };
  if (!cfg.src) setup(); else start(cfg);
}
function pick(list, n, not) { return shuffle(list.filter(function (x) { return x !== not; })).slice(0, n); }
async function buildQuiz(c) {
  loadData();
  var N = 10, out = [];
  if (c.src === 'irr') {
    shuffle(TJD.irregularVerbs).slice(0, N).forEach(function (v) {
      var askPast = Math.random() < 0.5, ans = (askPast ? v[1] : v[2]).split('/')[0];
      var ed = /e$/.test(v[0]) ? v[0] + 'd' : v[0] + 'ed';
      var other = (askPast ? v[2] : v[1]).split('/')[0];
      var opts = [ans, ed];
      if (other !== ans) opts.push(other);
      var rnd = pick(TJD.irregularVerbs, 3).map(function (x) { return x[askPast ? 1 : 2].split('/')[0]; });
      rnd.forEach(function (x) { if (opts.length < 4 && opts.indexOf(x) < 0) opts.push(x); });
      out.push({ prompt: '<span>' + (askPast ? 'الماضي من' : 'التصريف الثالث (past participle) من') + '</span> <b dir="ltr" class="qz-w">' + esc(v[0]) + '</b>', opts: shuffle(opts), answer: ans, explain: v.join(' → ') });
    });
    return out;
  }
  if (c.src === 'conf') {
    shuffle(TJD.confusables).forEach(function (cf) {
      if (out.length >= N) return;
      var ex = cf[2][Math.floor(Math.random() * cf[2].length)];
      var hit = null;
      cf[0].slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (w) {
        if (hit) return;
        var re = new RegExp('\\b(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(s|es|d|ed|ing)?\\b', 'i');
        var m = ex.match(re);
        if (m) hit = { w: w, m: m, suf: m[2] || '' };
      });
      if (!hit) return;
      var blank = ex.replace(hit.m[0], '_____');
      var cap = /^[A-Z]/.test(hit.m[0]);
      function form(w) { var f = w + hit.suf; return cap ? f.charAt(0).toUpperCase() + f.slice(1) : f; }
      out.push({ prompt: '<span>اختر الكلمة الصح:</span><div class="qz-sent" dir="ltr">' + esc(blank) + '</div>', opts: shuffle(cf[0].map(form)), answer: form(hit.w), explain: cf[1] });
    });
    return out;
  }
  var items;
  if (c.src === 'cards' || c.src === 'listen' && CARDS.length >= 4) {
    items = CARDS.filter(function (x) { return x.l !== 'ar'; }).map(function (x) { return { w: x.w, m: x.m }; });
  }
  if (!items || items.length < 4) {
    var lv = c.level || S.lvSel || 'B1';
    var pool = TJD.cefrRaw[lv].split('|').filter(function (w) { return /^[a-z]{3,}$/.test(w); });
    var ws = shuffle(pool).slice(0, 26);
    var tr = await A.translateMany(ws, 'en', 'ar');
    items = ws.map(function (w, i) { return { w: w, m: tr[i] || '' }; }).filter(function (x) { return x.m && x.m.toLowerCase() !== x.w; });
  }
  shuffle(items).slice(0, N).forEach(function (it, i) {
    var others = items.filter(function (x) { return x !== it; });
    var type = c.src === 'listen' ? 2 : i % 3;
    if (type === 0) {
      var o = pick(others.map(function (x) { return x.m; }), 3, it.m);
      out.push({ prompt: '<span>وش معنى</span> <b dir="ltr" class="qz-w">' + esc(it.w) + '</b>؟', say: it.w, opts: shuffle([it.m].concat(o)), answer: it.m, card: it });
    } else if (type === 1) {
      var o2 = pick(others.map(function (x) { return x.w; }), 3, it.w);
      out.push({ prompt: '<span>وش الكلمة الإنجليزية لـ</span> <b class="qz-w ar">' + esc(it.m) + '</b>؟', opts: shuffle([it.w].concat(o2)), answer: it.w, card: it });
    } else {
      var o3 = pick(others.map(function (x) { return x.w; }), 3, it.w);
      out.push({ prompt: '<span>اسمع واختر الكلمة اللي انقالت</span>', say: it.w, opts: shuffle([it.w].concat(o3)), answer: it.w, card: it, explain: it.w + ' = ' + it.m });
    }
  });
  return out;
}

/* =========================================================
   27. Word of the day + morning notification
   ========================================================= */
function wotdFor(d) {
  loadData();
  var pool = ['B1', 'B2', 'C1'].reduce(function (acc, l) { return acc.concat(TJD.cefrRaw[l].split('|')); }, []).filter(function (w) { return /^[a-z]{5,12}$/.test(w); });
  return pool[hash('tj' + dayKey(d)) % pool.length];
}
var wotdInfo = Store.get('wotdInfo', {});
async function wotdData(d) {
  var k = dayKey(d), w = wotdFor(d);
  if (wotdInfo[k] && wotdInfo[k].w === w && wotdInfo[k].m) return wotdInfo[k];
  var info = { w: w, m: await meaningOf(w, 'en'), def: '', defAr: '', ex: '' };
  try {
    var res = await A.lookupWord(w);
    var e = res && res.entries && res.entries[0];
    if (e) {
      info.def = (e.shortdef && e.shortdef[0]) || '';
      info.fl = e.fl || '';
      (e.senses || []).some(function (s) { if (s.ex && s.ex.length) { info.ex = String(s.ex[0]).replace(/<[^>]+>/g, ''); return true; } return false; });
    }
    if (info.def) info.defAr = (await A.translateMany([info.def], 'en', 'ar'))[0] || '';
  } catch (e2) {}
  var keys = Object.keys(wotdInfo).sort(); while (keys.length > 14) delete wotdInfo[keys.shift()];
  wotdInfo[k] = info; Store.set('wotdInfo', wotdInfo);
  return info;
}
function wotdHTML() {
  var w = wotdFor();
  return '<section class="wotd" id="wotd"><div class="wotd-top"><span class="wotd-l">' + icon('star') + 'كلمة اليوم</span>' + levelHTML(w) + '</div>' +
    '<div class="wotd-w" dir="ltr">' + esc(w) + '</div>' + (S.showPron ? '<div class="pr-us" data-pron-word="' + esc(w) + '"></div>' : '') +
    '<div class="wotd-m" id="wotdM">…</div><div class="wotd-def" id="wotdDef"></div>' +
    '<div class="ph-acts"><button type="button" class="pbtn" data-act="say-text" data-say="' + esc(w) + '">' + icon('speaker') + '<span>استمع</span></button>' +
    '<button type="button" class="pbtn" data-act="lv-dict" data-w="' + esc(w) + '">' + icon('book') + '<span>القاموس</span></button>' +
    '<button type="button" class="pbtn' + (findCard(w) ? ' is-on' : '') + '" data-act="card-add" data-w="' + esc(w) + '">' + icon(findCard(w) ? 'check' : 'cards') + '<span>' + (findCard(w) ? 'في البطاقات' : 'أضف للبطاقات') + '</span></button>' +
    '<button type="button" class="pbtn' + (S.wotdNotif ? ' is-on' : '') + '" data-act="wotd-notif">' + icon('bell') + '<span>' + (S.wotdNotif ? 'التنبيه الساعة ' + (S.wotdHour || 9) : 'نبّهني كل صباح') + '</span></button></div></section>';
}
function fillWotd() {
  wotdData().then(function (i) {
    var m = $('#wotdM'), d = $('#wotdDef');
    if (m) m.textContent = i.m || '';
    if (d) d.innerHTML = (i.defAr ? '<p class="def-ar">' + esc(i.defAr) + '</p>' : '') + (i.ex ? '<p class="ex-en" dir="ltr">' + esc(i.ex) + '</p>' : '');
  }).catch(function () { var m = $('#wotdM'); if (m) m.textContent = ''; });
}
A.ACTIONS['wotd-notif'] = function () {
  var hrs = [6, 7, 8, 9, 10, 12, 16, 20, 21];
  A.openModal('<h3>تنبيه كلمة اليوم</h3><p class="scr-hint">يوصلك كل يوم إشعار فيه كلمة جديدة ومعناها.</p><div class="chips" style="padding:4px">' +
    hrs.map(function (h) { return '<button type="button" class="chip' + (S.wotdNotif && (S.wotdHour || 9) === h ? ' is-sel' : '') + '" data-act="wotd-hour" data-h="' + h + '">' + (h < 12 ? h + ' الصبح' : h === 12 ? '12 الظهر' : (h - 12) + ' المسا') + '</button>'; }).join('') +
    '</div>' + (S.wotdNotif ? '<div class="actions"><button type="button" data-act="wotd-off">إيقاف التنبيه</button><button type="button" data-close>إغلاق</button></div>' : ''));
};
A.ACTIONS['wotd-hour'] = function (b) {
  var h = +b.getAttribute('data-h'); A.closeModal();
  Native.call('notify', { action: 'request' }).then(function () {
    S.wotdNotif = true; S.wotdHour = h; A.saveSettings();
    return scheduleWotd();
  }).then(function () { A.toast('تمام، يوصلك التنبيه كل يوم الساعة ' + (h <= 12 ? h : h - 12)); refreshLearn(); })
    .catch(function (e) { A.toast(A.errMsg(e)); });
};
A.ACTIONS['wotd-off'] = function () {
  A.closeModal(); S.wotdNotif = false; A.saveSettings();
  Native.call('notify', { action: 'cancel', ids: [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return 'tj.wotd.' + i; }) }).catch(function () {});
  refreshLearn();
};
async function scheduleWotd() {
  if (!S.wotdNotif) return;
  var ids = [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return 'tj.wotd.' + i; });
  await Native.call('notify', { action: 'cancel', ids: ids }).catch(function () {});
  var h = S.wotdHour || 9, now = new Date(), days = [];
  for (var i = 0; i < 8 && days.length < 7; i++) {
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, 0, 0);
    if (d > now) days.push(d);
  }
  var words = days.map(function (d) { return wotdFor(d); }), means = [];
  try { means = await A.translateMany(words, 'en', 'ar'); } catch (e) { means = []; }
  for (var k = 0; k < days.length; k++) {
    var d2 = days[k];
    await Native.call('notify', { action: 'schedule', id: ids[k], title: 'كلمة اليوم: ' + words[k], body: (means[k] ? means[k] + ' — ' : '') + 'افتح ترجمان وتعلّم نطقها ومعناها.',
      open: 'wotd', year: d2.getFullYear(), month: d2.getMonth() + 1, day: d2.getDate(), hour: d2.getHours(), minute: 0 }).catch(function () {});
  }
}
setTimeout(function () { if (S.wotdNotif) scheduleWotd(); }, 4000);

/* =========================================================
   34. Arabic dictionary: root + meaning in Arabic
   ========================================================= */
function arNorm(w) { return String(w || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').trim(); }
function rootPattern(w) {
  var L = w.split(''), n = L.length;
  if (n === 3) return w;
  if (n === 7 && w.indexOf('است') === 0 && L[5] === 'ا') return L[3] + L[4] + L[6];            // استفعال
  if (n === 6 && w.indexOf('است') === 0) return L[3] + L[4] + L[5];                             // استفعل
  if (n === 6) {
    if (L[0] === 'ا' && L[2] === 'ت' && L[4] === 'ا') return L[1] + L[3] + L[5];                // افتعال
    if (L[0] === 'ا' && L[1] === 'ن' && L[4] === 'ا') return L[2] + L[3] + L[5];                // انفعال
    if (L[0] === 'م' && L[2] === 'ا' && L[4] === 'ي') return L[1] + L[3] + L[5];                // مفاعيل
    if (L[0] === 'م' && L[1] === 'س' && L[2] === 'ت') return L[3] + L[4] + L[5];                // مستفعل
    if (L[0] === 'ت' && L[2] === 'ا' && L[4] === 'ي') return L[1] + L[3] + L[5];                // تفاعيل
  }
  if (n === 5) {
    if (L[0] === 'م' && L[3] === 'و') return L[1] + L[2] + L[4];                                // مفعول
    if (L[0] === 'ا' && L[2] === 'ت') return L[1] + L[3] + L[4];                                // افتعل
    if (L[0] === 'ا' && L[1] === 'ن') return L[2] + L[3] + L[4];                                // انفعل
    if (L[0] === 'ت' && L[2] === 'ا') return L[1] + L[3] + L[4];                                // تفاعل
    if (L[0] === 'م' && L[2] === 'ا') return L[1] + L[3] + L[4];                                // مفاعل
    if (L[0] === 'م' && L[1] === 'ت') return L[2] + L[3] + L[4];                                // متفعل
    if (L[0] === 'م' && L[3] === 'ا') return L[1] + L[2] + L[4];                                // مفعال
    if (L[0] === 'ت' && L[3] === 'ي') return L[1] + L[2] + L[4];                                // تفعيل
    if (L[2] === 'ا' && L[3] === 'ي') return L[0] + L[1] + L[4];                                // فعايل
    if (L[1] === 'ا' && L[3] === 'و') return L[0] + L[2] + L[4];                                // فاعول
  }
  if (n === 4) {
    if (L[1] === 'ا') return L[0] + L[2] + L[3];                                                // فاعل
    if (L[2] === 'ي' || L[2] === 'و' || L[2] === 'ا') return L[0] + L[1] + L[3];                // فعيل فعول فعال
    if ('متاين'.indexOf(L[0]) >= 0) return L[1] + L[2] + L[3];                                  // مفعل تفعل افعل يفعل
  }
  return '';
}
function arRoot(word) {
  var w = arNorm(word).replace(/\s+/g, '');
  if (!/^[ء-ي]+$/.test(w)) return '';
  var pre = ['وبال', 'وكال', 'فبال', 'وال', 'فال', 'بال', 'كال', 'لل', 'ال'];
  for (var i = 0; i < pre.length; i++) if (w.indexOf(pre[i]) === 0 && w.length - pre[i].length >= 3) { w = w.slice(pre[i].length); break; }
  var suf = ['تموها', 'كما', 'تما', 'هما', 'ات', 'ون', 'ين', 'ان', 'تم', 'كم', 'هم', 'هن', 'نا', 'ها', 'ية', 'وا', 'ه', 'ة', 'ي', 'ك', 'ت', 'ا'];
  // try the stem as is first, then with suffixes removed one at a time
  var stems = [w], cur = w, guard = 0;
  while (cur.length > 3 && guard++ < 4) {
    var hit = false;
    for (var j = 0; j < suf.length; j++) {
      var s2 = suf[j];
      if (cur.length - s2.length >= 3 && cur.slice(-s2.length) === s2) { cur = cur.slice(0, -s2.length); stems.push(cur); hit = true; break; }
    }
    if (!hit) break;
  }
  // also allow a leading و / ف conjunction
  if (/^[وف]/.test(w) && w.length >= 5) stems = stems.concat(stems.map(function (x) { return x.slice(1); }).filter(function (x) { return x.length >= 3; }));
  // prefer a stem of 5+ letters that fits a pattern, then a 4-letter fit, then any 3-letter stem
  var best = '';
  stems.slice().sort(function (a, b) { return b.length - a.length; }).some(function (st) { var r = st.length >= 4 ? rootPattern(st) : ''; if (r) { best = r; return true; } return false; });
  if (!best) stems.some(function (st) { if (st.length === 3) { best = st; return true; } return false; });
  if (!best) {
    var L = cur.split('');
    var core = L.filter(function (c, k) { return k === 0 || k === L.length - 1 || 'اوي'.indexOf(c) < 0; });
    if (core.length > 3 && /^[متاين]/.test(core[0])) core.shift();
    best = core.length === 3 || core.length === 4 ? core.join('') : '';
  }
  return best;
}
function parseJSON(s) { var m = String(s || '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } }
var arDictCache = new Map();
async function arMeaning(w) {
  if (arDictCache.has(w)) return arDictCache.get(w);
  var out = null;
  if (A.engineReady('claude')) {
    var sys = 'You are an expert Arabic lexicographer writing a concise Arabic-Arabic dictionary entry. For the Arabic word in the user message reply ONLY with JSON: ' +
      '{"root":"ك ت ب","pattern":"فِعال","pos":"اسم","meanings":["..."],"plural":"...","singular":"...","examples":["..."],"related":["..."],"dialect":""}. ' +
      'meanings: up to 4 clear Modern Standard Arabic definitions, most common first. If the word is dialectal (Gulf, Kuwaiti, Saudi, Levantine, Egyptian, Iraqi, Maghrebi), set "dialect" to the dialect name and give the MSA meaning. ' +
      'pattern is the morphological pattern (الوزن) with tashkeel. Leave unknown fields empty. examples: up to 2 short sentences. related: up to 8 common words from the same root. Use Arabic only.';
    try { out = parseJSON(await A.claudeCall(sys, w, 900)); if (out) out.src = 'claude'; } catch (e) { out = null; }
  }
  if (!out) {
    try {
      var r = await A.http('https://ar.wiktionary.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=text&page=' + encodeURIComponent(w), { timeout: 15 });
      if (r.status < 400) {
        var j = JSON.parse(r.body);
        if (j.parse && j.parse.text) {
          var doc = new DOMParser().parseFromString(j.parse.text, 'text/html');
          $$('ul, dl, .mw-references-wrap, sup, style', doc).forEach(function (n) { if (n.closest('li') || n.tagName === 'SUP' || n.tagName === 'STYLE') n.remove(); });
          var ms = $$('ol > li', doc).map(function (li) { return li.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim(); }).filter(function (t) { return t.length > 1 && isAr(t); }).slice(0, 5);
          if (ms.length) out = { meanings: ms, src: 'wiktionary' };
        }
      }
    } catch (e) {}
  }
  arDictCache.set(w, out);
  return out;
}
A.hookAdd('arabicLookup', function (box, q) {
  var w = arNorm(q);
  if (!w || w.split(/\s+/).length > 2) return;
  var root = arRoot(w);
  box.hidden = false;
  box.innerHTML = '<div class="block-h"><span>المعجم العربي</span></div><div class="extra-card ard"><div class="ard-head"><b class="ard-w">' + esc(q) + '</b>' +
    (root ? '<span class="ard-root" id="ardRoot">الجذر (تقريبي): ' + esc(root.split('').join(' ')) + '</span>' : '') + '</div><div class="ard-body" id="ardBody"><div class="empty" style="padding:8px">جاري البحث عن المعنى…</div></div></div>';
  arMeaning(q.trim()).then(function (d) {
    var b = $('#ardBody', box); if (!b) return;
    if (!d || !d.meanings || !d.meanings.length) {
      b.innerHTML = A.engineReady('claude') ? '<div class="scr-hint" style="margin:0">ما لقيت معنى عربي لهذي الكلمة.</div>' :
        '<div class="notice" style="margin:0">لشرح الكلمة بالعربي مع الجذر والوزن والجمع أضف مفتاح Claude. <button type="button" data-act="goto-claude">إضافة المفتاح</button></div>';
      return;
    }
    if (d.root && $('#ardRoot', box)) $('#ardRoot', box).textContent = 'الجذر: ' + d.root;
    else if (d.root) $('.ard-head', box).insertAdjacentHTML('beforeend', '<span class="ard-root">الجذر: ' + esc(d.root) + '</span>');
    var meta = [];
    if (d.pos) meta.push(d.pos);
    if (d.pattern) meta.push('الوزن: ' + d.pattern);
    if (d.plural) meta.push('الجمع: ' + d.plural);
    if (d.singular && d.singular !== q.trim()) meta.push('المفرد: ' + d.singular);
    if (d.dialect) meta.push('لهجة: ' + d.dialect);
    b.innerHTML = (meta.length ? '<div class="ard-meta">' + meta.map(esc).join(' · ') + '</div>' : '') +
      '<ol class="ard-ms">' + d.meanings.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ol>' +
      (d.examples && d.examples.length ? '<div class="ard-ex">' + d.examples.map(function (x) { return '<p>«' + esc(x) + '»</p>'; }).join('') + '</div>' : '') +
      (d.related && d.related.length ? '<div class="bt-label">من نفس الجذر</div><div class="chips">' + d.related.map(function (x) { return '<button type="button" class="chip ar" data-act="dict" data-w="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="ard-src">' + (d.src === 'claude' ? 'الشرح من Claude' : 'المصدر: ويكاموس') + '</div>';
  });
});
function arDictScreen() {
  closeAllAnd(function () { A.showView('dict'); var i = $('#dictInput'); i.value = ''; setTimeout(function () { i.focus(); }, 250); A.toast('اكتب أي كلمة عربية في البحث ويطلع لك معناها وجذرها'); });
}

/* =========================================================
   35. Grammar check (LanguageTool) with Arabic explanations
   ========================================================= */
async function ltCheck(text, lang) {
  var body = 'text=' + encodeURIComponent(text) + '&language=' + (lang === 'ar' ? 'ar' : 'en-US');
  var r = await A.http('https://api.languagetool.org/v2/check', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body: body, timeout: 25 });
  if (r.status === 429) throw A.err('lt_limit');
  if (r.status >= 400) throw A.err('http', { status: r.status });
  var j; try { j = JSON.parse(r.body); } catch (e) { throw A.err('bad_response'); }
  return (j.matches || []).map(function (m) {
    return { off: m.offset, len: m.length, msg: m.message || '', short: m.shortMessage || '', reps: (m.replacements || []).slice(0, 4).map(function (x) { return x.value; }), cat: (m.rule && m.rule.category && m.rule.category.name) || '', type: (m.rule && m.rule.issueType) || '' };
  });
}
function grammarScreen(prefill) {
  var sc = A.openScreen({ title: 'تدقيق القواعد والإملاء' });
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="gm-copy" aria-label="نسخ">' + icon('copy') + '</button>';
  sc.body.innerHTML = '<p class="scr-hint">اكتب أو الصق نص إنجليزي (أو عربي) ويطلع لك الأخطاء مع شرحها بالعربي والتصحيح.</p>' +
    '<div class="field" style="padding:0;border:0"><textarea id="gmIn" dir="auto" rows="5" placeholder="I has went to the market yesterday.">' + esc(prefill || '') + '</textarea></div>' +
    '<div class="ph-acts" style="margin-top:10px"><button type="button" class="pbtn" data-act="gm-run">' + icon('check') + '<span>دقّق</span></button>' +
    '<button type="button" class="pbtn" data-act="gm-fixall" hidden>' + icon('pen') + '<span>صحّح الكل</span></button>' +
    (A.engineReady('claude') ? '<button type="button" class="pbtn" data-act="gm-claude">' + icon('bulb') + '<span>صحّح واشرح (Claude)</span></button>' : '') + '</div>' +
    '<div id="gmOut"></div>';
  var M = [], text = '';
  function render() {
    var out = $('#gmOut', sc.body);
    $('[data-act="gm-fixall"]', sc.body).hidden = !M.some(function (m) { return m.reps.length; });
    if (!M.length) { out.innerHTML = '<div class="gm-ok">' + icon('check') + '<span>ما لقيت أخطاء. النص سليم 👌</span></div>'; return; }
    var h = '', pos = 0;
    M.forEach(function (m, i) {
      h += esc(text.slice(pos, m.off)) + '<mark class="gm-m t-' + esc(m.type) + '" data-i="' + i + '">' + esc(text.substr(m.off, m.len) || '␣') + '</mark>';
      pos = m.off + m.len;
    });
    h += esc(text.slice(pos));
    out.innerHTML = '<div class="gm-text" dir="auto">' + h + '</div><div class="block-h"><span>' + M.length + ' ملاحظة</span></div>' +
      M.map(function (m, i) {
        return '<div class="gm-card" data-i="' + i + '"><div class="gm-bad" dir="auto">' + esc(text.substr(m.off, m.len)) + '</div>' +
          '<div class="gm-ar">' + esc(m.ar || m.msg) + '</div>' + (m.ar && m.ar !== m.msg ? '<div class="gm-en" dir="ltr">' + esc(m.msg) + '</div>' : '') +
          (m.reps.length ? '<div class="chips">' + m.reps.map(function (r, k) { return '<button type="button" class="chip en" data-act="gm-apply" data-i="' + i + '" data-k="' + k + '">' + esc(r || '(احذف)') + '</button>'; }).join('') + '</div>' : '') + '</div>';
      }).join('');
  }
  function apply(i, k) {
    var m = M[i]; if (!m) return;
    var rep = m.reps[k] != null ? m.reps[k] : '';
    var delta = rep.length - m.len;
    text = text.slice(0, m.off) + rep + text.slice(m.off + m.len);
    M.splice(i, 1);
    M.forEach(function (x) { if (x.off > m.off) x.off += delta; });
    $('#gmIn', sc.body).value = text;
    render();
  }
  A.ACTIONS['gm-run'] = async function () {
    text = $('#gmIn', sc.body).value;
    if (!text.trim()) return;
    var out = $('#gmOut', sc.body);
    out.innerHTML = '<div class="empty">جاري التدقيق…</div>';
    try {
      M = await ltCheck(text, isAr(text) ? 'ar' : 'en');
      bump('gram');
      render();
      var need = M.filter(function (m) { return !isAr(m.msg); });
      if (need.length) {
        var tr = await A.translateMany(need.map(function (m) { return m.msg.replace(/[‘’]/g, "'"); }), 'en', 'ar');
        need.forEach(function (m, i) { m.ar = tr[i]; });
        render();
      }
    } catch (e) { out.innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; }
  };
  A.ACTIONS['gm-apply'] = function (b) { apply(+b.getAttribute('data-i'), +b.getAttribute('data-k')); };
  A.ACTIONS['gm-fixall'] = function () {
    for (var i = M.length - 1; i >= 0; i--) if (M[i].reps.length) apply(i, 0);
    A.toast('تم التصحيح');
  };
  A.ACTIONS['gm-copy'] = function () { Native.call('copy', { text: $('#gmIn', sc.body).value }).catch(function () {}); A.toast('نُسخ'); };
  A.ACTIONS['gm-claude'] = function () {
    var t = $('#gmIn', sc.body).value.trim(); if (!t) return;
    var out = $('#gmOut', sc.body);
    out.innerHTML = '<div class="empty">جاري التصحيح…</div>';
    A.claudeCall('You are a kind English teacher for Arabic speakers. Correct the user text (grammar, spelling, word choice, naturalness). ' +
      'Reply ONLY with JSON: {"corrected":"...","notes":["..."]}. notes: short explanations in Arabic (Gulf-friendly simple Arabic) of each important correction, quoting the English words. Max 8 notes. If the text is already correct, notes = [].', t, 1800)
      .then(function (r) {
        var j = parseJSON(r) || { corrected: r, notes: [] };
        out.innerHTML = '<div class="block-h"><span>النص المصحح</span></div><div class="extra-card"><p class="extra-text en" dir="ltr">' + esc(j.corrected || '') + '</p>' +
          '<div class="extra-acts"><button type="button" class="pbtn" data-act="gm-use">' + icon('check') + '<span>استخدمه</span></button><button type="button" class="pbtn" data-act="say-text" data-say="' + esc(j.corrected || '') + '">' + icon('speaker') + '<span>استمع</span></button></div></div>' +
          (j.notes && j.notes.length ? '<div class="block-h" style="margin-top:12px"><span>الشرح</span></div><div class="extra-card"><ul class="gm-notes">' + j.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '');
        A.ACTIONS['gm-use'] = function () { $('#gmIn', sc.body).value = j.corrected || ''; out.innerHTML = ''; };
        bump('gram');
      }).catch(function (e) { out.innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; });
  };
  if (prefill) A.ACTIONS['gm-run']();
}
A.addResultAction({ id: 'grammar', label: 'دقّق القواعد', sub: 'أخطاء الإملاء والقواعد في نصك مع شرح بالعربي', icon: 'check', order: 19,
  when: function (r) { return r.sl === 'en' && /\s/.test(r.source.trim()); },
  run: function (r) { grammarScreen(r.source); } });

/* =========================================================
   57. Travel phrasebook
   ========================================================= */
function phrasebookScreen() {
  var lang = S.pbLang && LANG[S.pbLang] && S.pbLang !== 'ar' ? S.pbLang : 'en';
  var sc = A.openScreen({ title: 'عبارات السفر' });
  function home() {
    sc.body.innerHTML = '<div class="field" style="padding:0;border:0;margin-bottom:12px"><div class="f-label"><span>لغة البلد</span></div><select id="pbLang">' +
      A.LANG_ORDER.filter(function (l) { return l !== 'ar'; }).map(function (l) { return '<option value="' + l + '"' + (l === lang ? ' selected' : '') + '>' + LANG[l].ar + ' (' + LANG[l].name + ')</option>'; }).join('') + '</select></div>' +
      '<div class="tiles">' + TJD.phrasebook.map(function (c) {
        return '<button type="button" class="tile" data-act="pb-cat" data-c="' + c.id + '"><span class="tile-ic">' + icon(c.icon) + '</span><b>' + esc(c.title) + '</b><small>' + c.items.length + ' عبارة</small></button>';
      }).join('') + '</div>';
    $('#pbLang', sc.body).addEventListener('change', function () { lang = this.value; S.pbLang = lang; A.saveSettings(); });
  }
  async function cat(id) {
    var c = TJD.phrasebook.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    sc.el.querySelector('.scr-top h2').textContent = c.title;
    var list = c.items.map(function (x) { return x[1]; });
    sc.body.innerHTML = '<div class="ph-acts"><button type="button" class="pbtn" data-act="pb-home">' + icon('back') + '<span>الأقسام</span></button></div><div id="pbList"></div>';
    var tr = list;
    if (lang !== 'en') {
      var key = 'pb:' + lang + ':' + id, cached = Store.get(key, null);
      if (cached && cached.length === list.length) tr = cached;
      else {
        $('#pbList', sc.body).innerHTML = '<div class="empty">جاري الترجمة إلى ' + LANG[lang].ar + '…</div>';
        try { tr = await A.translateMany(list, 'en', lang); Store.set(key, tr); } catch (e) { $('#pbList', sc.body).innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; return; }
      }
    }
    $('#pbList', sc.body).innerHTML = c.items.map(function (x, i) {
      return '<div class="pb-row"><button type="button" class="pb-main" data-act="pb-big" data-i="' + i + '"><div class="pb-ar">' + esc(x[0]) + '</div><div class="pb-tr ' + A.styleClass(lang) + '" dir="auto">' + esc(tr[i]) + '</div></button>' +
        '<button type="button" class="ic" data-act="pb-say" data-i="' + i + '" aria-label="استمع">' + icon('speaker') + '</button></div>';
    }).join('');
    A.ACTIONS['pb-say'] = function (b) { A.speak(tr[+b.getAttribute('data-i')], lang); };
    A.ACTIONS['pb-big'] = function (b) {
      var i = +b.getAttribute('data-i');
      A.speak(tr[i], lang);
      A.openModal('<div class="pb-bigv"><div class="pb-big-t ' + A.styleClass(lang) + '" dir="auto">' + esc(tr[i]) + '</div><div class="pb-big-a">' + esc(c.items[i][0]) + '</div></div>' +
        '<div class="actions"><button type="button" data-act="pb-say" data-i="' + i + '">استمع مرة ثانية</button><button type="button" data-close>إغلاق</button></div>');
    };
  }
  A.ACTIONS['pb-cat'] = function (b) { cat(b.getAttribute('data-c')); };
  A.ACTIONS['pb-home'] = function () { sc.el.querySelector('.scr-top h2').textContent = 'عبارات السفر'; home(); };
  home();
}

/* =========================================================
   37b. Stats screen
   ========================================================= */
function statsScreen() {
  var sc = A.openScreen({ title: 'إحصائياتي' });
  var days = [], now = new Date();
  for (var i = 6; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); days.push({ k: dayKey(d), d: d, a: activity(ST.d[dayKey(d)]) }); }
  var max = Math.max.apply(null, days.map(function (x) { return x.a; }).concat([1]));
  var DN = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  var tot = { tr: 0, look: 0, rev: 0, revOk: 0, quiz: 0, quizOk: 0, speak: 0, gram: 0 }, active = 0;
  Object.keys(ST.d).forEach(function (k) { var x = ST.d[k]; if (activity(x)) active++; Object.keys(tot).forEach(function (f) { tot[f] += x[f] || 0; }); });
  var mastered = CARDS.filter(function (c) { return c.ivl >= 21; }).length, learning = CARDS.filter(function (c) { return !c.n && c.ivl < 21; }).length;
  function box(n, l) { return '<div class="st-box"><b>' + n + '</b><span>' + l + '</span></div>'; }
  sc.body.innerHTML = '<div class="st-grid">' + box(streak() + ' 🔥', 'أيام متتالية') + box(Math.max(ST.best || 0, streak()), 'أطول سلسلة') + box(active, 'أيام نشاط') + '</div>' +
    '<div class="block-h"><span>آخر 7 أيام</span></div><div class="st-chart">' + days.map(function (x) {
      return '<div class="st-col"><div class="st-bar"><i style="height:' + Math.round(100 * x.a / max) + '%"></i></div><b>' + x.a + '</b><span>' + DN[x.d.getDay()] + '</span></div>';
    }).join('') + '</div>' +
    '<div class="block-h"><span>البطاقات</span></div><div class="st-grid">' + box(CARDS.length, 'كل البطاقات') + box(mastered, 'محفوظة') + box(learning, 'قيد الحفظ') + '</div>' +
    '<div class="block-h"><span>المجموع (آخر 4 شهور)</span></div><div class="panel">' +
    [['ترجمات', tot.tr], ['بحث في القاموس', tot.look], ['مراجعة بطاقات', tot.rev + (tot.rev ? ' (صح ' + Math.round(100 * tot.revOk / tot.rev) + '٪)' : '')],
      ['أسئلة اختبار', tot.quiz + (tot.quiz ? ' (صح ' + Math.round(100 * tot.quizOk / tot.quiz) + '٪)' : '')], ['تمارين نطق', tot.speak], ['تدقيق قواعد', tot.gram]]
      .map(function (r) { return '<div class="row"><div class="r-main"><div class="r-title">' + r[0] + '</div></div><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
}

/* =========================================================
   Learn tab
   ========================================================= */
var TILES = [];
function addLearnTile(t) { TILES.push(t); TILES.sort(function (a, b) { return (a.order || 50) - (b.order || 50); }); }
A.addLearnTile = addLearnTile;
addLearnTile({ id: 'quiz', label: 'اختبار', sub: 'معاني، استماع، أفعال', icon: 'quiz', order: 10, run: function () { quizScreen(); } });
addLearnTile({ id: 'levels', label: 'المستويات', sub: 'كلمات A1 إلى C2', icon: 'chart', order: 20, run: function () { levelsScreen(); } });
addLearnTile({ id: 'irr', label: 'التصريف', sub: 'الأفعال الشاذة والجمع', icon: 'repeat', order: 30, run: irregularScreen });
addLearnTile({ id: 'colloc', label: 'التلازم اللفظي', sub: 'make a decision', icon: 'link', order: 40, run: function () { collocScreen(); } });
addLearnTile({ id: 'conf', label: 'كلمات تتلخبط', sub: 'affect / effect', icon: 'bulb', order: 50, run: confScreen });
addLearnTile({ id: 'grammar', label: 'تدقيق القواعد', sub: 'أخطاءك مشروحة بالعربي', icon: 'check', order: 60, run: function () { grammarScreen(); } });
addLearnTile({ id: 'ardict', label: 'المعجم العربي', sub: 'المعنى والجذر والوزن', icon: 'root', order: 70, run: arDictScreen });
addLearnTile({ id: 'phrases', label: 'عبارات السفر', sub: 'المطار، الفندق، المطعم…', icon: 'plane', order: 80, run: phrasebookScreen });
addLearnTile({ id: 'stats', label: 'إحصائياتي', sub: 'السلسلة والتقدم', icon: 'chart', order: 90, run: statsScreen });

function refreshLearn() {
  var body = $('#learnBody'); if (!body) return;
  if (!$('#view-learn').classList.contains('is-active') && body.getAttribute('data-ready')) return;
  body.setAttribute('data-ready', '1');
  var due = dueCount(), nw = newCount(), td = dayStats(), sk = streak();
  body.innerHTML = '<div class="lp-stats"><span class="lp-streak">' + (sk ? '🔥 ' + sk + (sk === 1 ? ' يوم' : ' أيام') + ' متتالية' : 'ابدأ سلسلتك اليوم 🔥') + '</span>' +
    '<span>اليوم: ' + (td.rev || 0) + ' مراجعة · ' + (td.tr || 0) + ' ترجمة</span></div>' +
    wotdHTML() +
    '<section class="rv-card"><div class="rv-main"><div class="rv-t">بطاقاتك</div><div class="rv-s">' +
    (CARDS.length ? '<b>' + due + '</b> للمراجعة · <b>' + nw + '</b> جديدة · ' + CARDS.length + ' بالمجموع' : 'أضف كلمات من القاموس أو الترجمة وتراجعها هنا بالتكرار المتباعد') + '</div></div>' +
    '<div class="rv-acts"><button type="button" class="rv-go" data-act="lp-review"' + (due + nw ? '' : ' disabled') + '>' + (due + nw ? 'ابدأ المراجعة' : 'خلصت 👌') + '</button>' +
    '<button type="button" class="link-btn" data-act="lp-cards">كل البطاقات</button></div></section>' +
    '<div class="tiles">' + TILES.map(function (t) {
      return '<button type="button" class="tile" data-act="lp-tile" data-id="' + t.id + '"><span class="tile-ic">' + icon(t.icon) + '</span><b>' + esc(t.label) + '</b><small dir="auto">' + esc(t.sub || '') + '</small></button>';
    }).join('') + '</div>' +
    '<p class="about" style="margin-top:18px">مستويات الكلمات: CEFR‑J Vocabulary Profile وOctanove C1/C2. الشيوع: FrequencyWords. التلازم: Datamuse. التدقيق: LanguageTool.</p>';
  A.fillPron(body);
  fillWotd();
}
A.ACTIONS['lp-review'] = function () { reviewScreen(); };
A.ACTIONS['lp-cards'] = function () { cardsScreen(); };
A.ACTIONS['lp-tile'] = function (b) { var t = TILES.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0]; if (t) { A.haptic(); t.run(); } };
A.hookAdd('view', function (v) { if (v === 'learn') refreshLearn(); });
A.refreshLearn = refreshLearn;

/* settings */
A.hookAdd('settingsGroups', function () {
  return '<div class="group"><h2>التعلّم</h2><div class="panel">' +
    '<div class="row"><div class="r-main"><div class="r-title">تنبيه الكلمات المتشابهة</div><div class="r-sub">تحت الترجمة يذكّرك إذا فيه كلمة تتلخبط مع غيرها (مثل affect و effect).</div></div>' +
    '<button type="button" class="switch' + (S.confHints ? ' is-on' : '') + '" data-act="toggle" data-k="confHints" role="switch" aria-checked="' + !!S.confHints + '"></button></div>' +
    '<div class="row choice" data-act="wotd-notif"><div class="r-main"><div class="r-title">تنبيه كلمة اليوم</div><div class="r-sub">' + (S.wotdNotif ? 'كل يوم الساعة ' + (S.wotdHour || 9) : 'متوقف') + '</div></div><span class="link-btn">تغيير</span></div>' +
    '</div></div>';
});

/* routes for links / notifications */
A.MORE_ROUTES = Object.assign(A.MORE_ROUTES || {}, {
  wotd: function () { A.showView('learn'); setTimeout(function () { var w = $('#wotd'); if (w) w.scrollIntoView({ behavior: 'smooth' }); }, 200); },
  review: function () { A.showView('learn'); reviewScreen(); },
  cards: function () { A.showView('learn'); cardsScreen(); },
  quiz: function () { A.showView('learn'); quizScreen(); },
  phrases: function () { A.showView('learn'); phrasebookScreen(); },
  grammar: function (p) { A.showView('learn'); grammarScreen(p && p.text); },
  colloc: function (p) { A.showView('learn'); collocScreen(p && (p.q || p.word)); }
});

A.Learn = { levelOf: levelOf, rankOf: rankOf, verbForms: verbForms, pluralOf: pluralOf, comparOf: comparOf, arRoot: arRoot, addCard: addCard, findCard: findCard,
  cards: function () { return CARDS; }, setCards: function (c) { CARDS = c; saveCards(); }, analyzeLevel: analyzeLevel, collocations: collocations, schedule: schedule, wotdFor: wotdFor, streak: streak };
})();
