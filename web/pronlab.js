'use strict';
/* Pronunciation lab: scoring (38), record & compare (39), shadowing (40), word stress (41), American vs British (42),
   minimal pairs (43), connected speech (44). */
(function () {
var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, S = A.S, Native = A.Native, LANG = A.LANG;
function bump(f) { if (A.learnBump) A.learnBump(f); }
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
A.EXTRA_ERR.no_recording = 'ما فيه تسجيل للحين. سجّل صوتك أول.';
A.EXTRA_ERR.rec_failed = 'تعذر بدء التسجيل.';

/* =========================================================
   41. Word stress: syllables of the spelling + IPA
   ========================================================= */
var DIGRAPH = ['ch', 'sh', 'th', 'ph', 'wh', 'gh', 'qu'];
var ONSET2 = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'wr', 'th', 'sh', 'ch', 'ph', 'wh', 'qu'];
function spellSylls(word) {
  var w = String(word), lw = w.toLowerCase();
  if (!/^[a-z]+$/.test(lw)) return null;
  function isV(i) {
    var c = lw[i];
    if ('aeiou'.indexOf(c) >= 0) return !(c === 'u' && i > 0 && lw[i - 1] === 'q');
    if (c === 'y') return i > 0 && 'aeiou'.indexOf(lw[i + 1] || '') < 0;
    return false;
  }
  var g = [];
  for (var i = 0; i < lw.length; i++) {
    if (isV(i)) { if (g.length && g[g.length - 1][1] === i) g[g.length - 1][1] = i + 1; else g.push([i, i + 1]); }
  }
  if (!g.length) return [w];
  // vowel pairs that are usually two syllables (evaluate, radio, piano) — not in -tion/-cial/-sion
  var g2 = [];
  g.forEach(function (x) {
    var v = lw.slice(x[0], x[1]), before = lw[x[0] - 1] || '';
    var split = v.length === 2 && (v === 'ua' || v === 'uo' || v === 'iu' || ((v === 'ia' || v === 'io') && 'ctsx'.indexOf(before) < 0));
    if (split) { g2.push([x[0], x[0] + 1]); g2.push([x[0] + 1, x[1]]); } else g2.push(x);
  });
  g = g2;
  var L = lw.length, last = g[g.length - 1];
  if (g.length > 1 && last[0] === L - 1 && lw[L - 1] === 'e' && !/[^aeiou]le$/.test(lw)) g.pop();
  else if (g.length > 1 && last[0] === L - 2 && /[^td]ed$/.test(lw)) g.pop();
  else if (g.length > 1 && last[0] === L - 2 && /[^aeiouszxhcg]es$/.test(lw)) g.pop();
  var cuts = [];
  for (var k = 0; k < g.length - 1; k++) {
    var a = g[k][1], b = g[k + 1][0], cons = lw.slice(a, b), cut;
    var cle = k + 1 === g.length - 1 && b === L - 1 && /[^aeiou]le$/.test(lw);
    if (cle && cons.length >= 2) cut = b - 2;                       // ta-ble, sim-ple
    else if (cons.length <= 1) cut = a;
    else if (cons.length === 2) cut = DIGRAPH.indexOf(cons) >= 0 ? a : (cons === 'ck' || cons === 'ng' || cons === 'x') ? b : a + 1;
    else cut = ONSET2.indexOf(cons.slice(-2)) >= 0 ? b - 2 : b - 1;
    cuts.push(cut);
  }
  var out = [], prev = 0;
  cuts.forEach(function (c) { out.push(w.slice(prev, c)); prev = c; });
  out.push(w.slice(prev));
  return out.filter(Boolean);
}
function stressInfo(word) {
  if (!window.Pron || !Pron.ready() || !Pron.syllables) return null;
  var sy = Pron.syllables(word);
  if (!sy) return null;
  var sp = spellSylls(word);
  if (sp && sp.length !== sy.length) sp = null;
  if (sy.length === 1) sy[0].stress = 1;
  return { sy: sy, sp: sp };
}
function stressHTML(word) {
  var s = stressInfo(word);
  if (!s) return '';
  var spell = s.sp ? s.sp.map(function (x, i) { return '<span class="sy s' + s.sy[i].stress + '">' + esc(x) + '</span>'; }).join('<i>·</i>') : '';
  var ipa = s.sy.map(function (x) { return '<span class="sy s' + x.stress + '">' + esc(x.ipa) + '</span>'; }).join('<i>·</i>');
  var n = s.sy.length, p = 0;
  s.sy.forEach(function (x, i) { if (x.stress === 1) p = i; });
  var ord = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'][p] || (p + 1);
  return '<div class="st-word" dir="ltr">' + (spell ? '<div class="st-spell">' + spell + '</div>' : '') + '<div class="st-ipa">/' + ipa + '/</div></div>' +
    (n > 1 ? '<div class="st-note">' + n + ' مقاطع، والضغط على المقطع ' + ord + ' (الملوّن)</div>' : '<div class="st-note">مقطع واحد</div>');
}
A.stressHTML = stressHTML;
/* show stress in dictionary entries */
A.hookAdd('afterLookup', function (box, res, word, opts) {
  if (!S.showPron || (opts && opts.compact)) return;
  Pron.load().then(function () {
    var art = $('article.entry', box), e = res.entries[0];
    if (!art || !e) return;
    var hw = (e.base || e.hw || '').replace(/[·*]/g, '');
    if (!/^[A-Za-z]+$/.test(hw)) return;
    var sy = Pron.syllables(hw);
    if (!sy || sy.length < 2) return;
    var h = stressHTML(hw);
    if (!h || $('.st-box', art)) return;
    var head = $('.entry-head', art);
    if (head) head.insertAdjacentHTML('beforeend', '<div class="st-box"><span class="fm-l">النبرة</span>' + h + '</div>');
  }).catch(function () {});
});

/* =========================================================
   42. American vs British (approximate British IPA)
   ========================================================= */
var BATH = new Set(("ask asked asking asks bath baths path paths class classes glass glasses grass pass passed passing past fast faster last after afternoon answer answered answers can't " +
  'dance dancing dancer chance plant plants example half laugh laughed laughing banana castle branch demand rather master task mask staff aunt advance advanced command disaster ' +
  'france graph craft draft raft calf calm palm father nasty vast cast mast blast basket').split(' '));
var VOW = 'aeiouæɑɒɔəɛɜɪʊʌ';
var UK_X = { schedule: 'ˈʃɛdjuːl', vitamin: 'ˈvɪtəmɪn', privacy: 'ˈprɪvəsi', tomato: 'təˈmɑːtəʊ', garage: 'ˈɡærɑːʒ', advertisement: 'ədˈvɜːtɪsmənt',
  leisure: 'ˈlɛʒə', herb: 'hɜːb', mobile: 'ˈməʊbaɪl', either: 'ˈaɪðə', neither: 'ˈnaɪðə', route: 'ruːt', adult: 'ˈædʌlt', missile: 'ˈmɪsaɪl', fragile: 'ˈfrædʒaɪl',
  laboratory: 'ləˈbɒrətri', zebra: 'ˈzɛbrə', clerk: 'klɑːk', tuesday: 'ˈtjuːzdeɪ', new: 'njuː', news: 'njuːz', student: 'ˈstjuːdənt', duty: 'ˈdjuːti', data: 'ˈdeɪtə',
  been: 'biːn', again: 'əˈɡɛn', process: 'ˈprəʊsɛs', progress: 'ˈprəʊɡrɛs', yogurt: 'ˈjɒɡət', aluminum: 'ˌæljʊˈmɪniəm', ballet: 'ˈbæleɪ', buffet: 'ˈbʊfeɪ', oregano: 'ˌɒrɪˈɡɑːnəʊ' };
function ukIPA(word, us) {
  var w = String(word).toLowerCase(), s = us;
  if (UK_X[w]) return UK_X[w];
  s = s.replace(/ɝ/g, 'ɜː').replace(/ɚ/g, 'ə');
  s = s.replace(/ɑr/g, 'ɑː').replace(/ɔr/g, 'ɔː');
  s = s.replace(new RegExp('ɛr(?![ˈˌ]?[' + VOW + '])', 'g'), 'eə').replace(new RegExp('ɪr(?![ˈˌ]?[' + VOW + '])', 'g'), 'ɪə').replace(new RegExp('ʊr(?![ˈˌ]?[' + VOW + '])', 'g'), 'ʊə');
  s = s.replace(new RegExp('r(?![ˈˌ]?[' + VOW + 'j])', 'g'), '');
  s = s.replace(/oʊ/g, 'əʊ');
  s = s.replace(/ɾ/g, /t/.test(w) ? 't' : 'd');
  if (/o/.test(w)) s = s.replace(/ɑ(?!ː)/g, 'ɒ');
  if (BATH.has(w)) s = s.replace(/æ/, 'ɑː');
  s = s.replace(/i(?!ː)/g, 'iː').replace(/(^|[^aoʊ])u(?!ː)/g, '$1uː').replace(/ɔ(?![ːɪ])/g, 'ɔː');
  s = s.replace(/iː$/, 'i');
  if (/(^|[^aeiou])([tdn])(u|ew|eu)/.test(w)) s = s.replace(/([tdn])uː/, '$1juː');
  return s;
}
function usUkScreen() {
  var sc = A.openScreen({ title: 'أمريكي وبريطاني' });
  sc.body.innerHTML = '<p class="scr-hint">اكتب أي كلمة وقارن نطقها الأمريكي والبريطاني، أو اسمع الكلمات المشهورة اللي تختلف.</p>' +
    '<form class="url-form" id="uuForm"><input id="uuIn" type="text" dir="ltr" autocapitalize="off" autocorrect="off" placeholder="water"><button type="submit" class="pbtn">قارن</button></form><div id="uuOut"></div>' +
    '<div class="block-h"><span>كلمات تختلف</span></div><div id="uuList">' + TJD.usuk.map(function (r) {
      return '<div class="uu-row"><div class="uu-w" dir="ltr">' + esc(r[0]) + '</div>' +
        '<div class="uu-cols"><button type="button" class="uu-b" data-act="uu-say" data-w="' + esc(r[0]) + '" data-v="us"><span class="flag">🇺🇸</span><span dir="ltr">' + esc(r[1]) + '</span></button>' +
        '<button type="button" class="uu-b" data-act="uu-say" data-w="' + esc(r[0]) + '" data-v="uk"><span class="flag">🇬🇧</span><span dir="ltr">' + esc(r[2]) + '</span></button></div>' +
        (r[3] ? '<div class="uu-n">' + esc(r[3]) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  $('#uuForm', sc.body).addEventListener('submit', function (e) {
    e.preventDefault();
    var w = $('#uuIn', sc.body).value.trim();
    if (!/^[A-Za-z'\-]+$/.test(w)) { A.toast('اكتب كلمة إنجليزية وحدة'); return; }
    Pron.load().then(function () {
      var info = Pron.word(w);
      if (!info.known) { $('#uuOut', sc.body).innerHTML = '<div class="notice">ما لقيت نطق هذي الكلمة.</div>'; return; }
      $('#uuOut', sc.body).innerHTML = '<div class="extra-card uu-cmp"><div class="uu-w" dir="ltr">' + esc(w) + '</div>' + stressHTML(w) +
        '<div class="uu-cols"><button type="button" class="uu-b" data-act="uu-say" data-w="' + esc(w) + '" data-v="us"><span class="flag">🇺🇸</span><span class="ipa" dir="ltr">/' + esc(info.ipa) + '/</span></button>' +
        '<button type="button" class="uu-b" data-act="uu-say" data-w="' + esc(w) + '" data-v="uk"><span class="flag">🇬🇧</span><span class="ipa" dir="ltr">/' + esc(ukIPA(w, info.ipa)) + '/</span></button></div>' +
        '<div class="uu-n">الكتابة الصوتية البريطانية تقريبية. اضغط أي واحد تسمعه.</div></div>';
      A.speak(w, 'en');
    });
  });
}
A.ACTIONS['uu-say'] = function (b) {
  var v = b.getAttribute('data-v'), w = b.getAttribute('data-w');
  A.speak(w, 'en', 0.9, v === 'uk' ? { locale: 'en-GB' } : null);
};

/* =========================================================
   38. Scoring helpers
   ========================================================= */
function normTok(t) { return String(t).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, ''); }
function lev(a, b) {
  var m = a.length, n = b.length, d = [];
  for (var i = 0; i <= m; i++) { d[i] = [i]; }
  for (var j = 1; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
var NUMS = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
function same(a, b) {
  if (a === b) return true;
  if (a.replace(/'/g, '') === b.replace(/'/g, '')) return true;
  if (NUMS[a] === b || NUMS[b] === a) return true;
  if (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1) return true;
  return false;
}
/* target text + speech event → per-word result and score */
function scoreSpeech(target, d) {
  var disp = String(target).split(/\s+/).filter(Boolean);
  var T = disp.map(normTok), keep = [];
  T.forEach(function (t, i) { if (t) keep.push(i); });
  var tw = keep.map(function (i) { return T[i]; });
  var H = String(d.text || '').split(/\s+/).map(normTok).filter(Boolean);
  // confidence per heard token (segments can hold one word each)
  var segs = (d.segs || []).map(function (s) { return { t: normTok(s.t), c: s.c }; }).filter(function (s) { return s.t; });
  var hc = H.map(function (h, j) { var s = segs[j]; return s && s.t === h ? s.c : (segs.filter(function (x) { return x.t === h; })[0] || {}).c; });
  var m = tw.length, n = H.length, D = [], P = [];
  for (var i = 0; i <= m; i++) { D[i] = []; P[i] = []; for (var j = 0; j <= n; j++) {
    if (!i && !j) { D[i][j] = 0; continue; }
    var best = Infinity, op = '';
    if (i && j) { var c = D[i - 1][j - 1] + (same(tw[i - 1], H[j - 1]) ? 0 : 1); if (c < best) { best = c; op = same(tw[i - 1], H[j - 1]) ? 'm' : 's'; } }
    if (i && D[i - 1][j] + 1 < best) { best = D[i - 1][j] + 1; op = 'd'; }
    if (j && D[i][j - 1] + 1 < best) { best = D[i][j - 1] + 1; op = 'i'; }
    D[i][j] = best; P[i][j] = op;
  } }
  var res = new Array(m), ins = 0;
  i = m; j = n;
  while (i > 0 || j > 0) {
    var o = P[i][j];
    if (o === 'm') { var cf = hc[j - 1]; res[i - 1] = { st: cf != null && cf > 0 && cf < 0.45 ? 'weak' : 'ok', heard: H[j - 1], conf: cf }; i--; j--; }
    else if (o === 's') { res[i - 1] = { st: 'miss', heard: H[j - 1] }; i--; j--; }
    else if (o === 'd') { res[i - 1] = { st: 'miss', heard: '' }; i--; }
    else { ins++; j--; }
  }
  var ok = 0, weak = 0;
  res.forEach(function (r) { if (r.st === 'ok') ok++; else if (r.st === 'weak') weak++; });
  var pct = m ? Math.round(100 * (ok + 0.5 * weak) / m) - 4 * Math.max(0, ins - 1) : 0;
  pct = Math.max(0, Math.min(100, pct));
  var words = disp.map(function (w, k) { var idx = keep.indexOf(k); return { w: w, r: idx >= 0 ? res[idx] : { st: 'ok' } }; });
  return { pct: pct, words: words, heard: d.text || '' };
}
function scoreLabel(p) { return p >= 90 ? 'ممتاز! نطق واضح جدًا' : p >= 75 ? 'زين جدًا' : p >= 55 ? 'مقبول، ركّز على الكلمات الحمراء' : 'يحتاج تمرين، اسمع وكرر ببطء'; }
function scoreHTML(sc) {
  var col = sc.pct >= 80 ? 'ok' : sc.pct >= 55 ? 'mid' : 'bad';
  return '<div class="sc-top"><div class="sc-ring sc-' + col + '" style="--p:' + sc.pct + '"><b>' + sc.pct + '</b></div><div class="sc-txt"><b>' + scoreLabel(sc.pct) + '</b>' +
    '<span>سمعتك تقول: <i dir="ltr">' + esc(sc.heard || '—') + '</i></span></div></div>' +
    '<div class="sc-words" dir="ltr">' + sc.words.map(function (x) {
      return '<button type="button" class="scw scw-' + x.r.st + '" data-act="pl-word" data-w="' + esc(x.w.replace(/[^A-Za-z'’\-]/g, '')) + '">' + esc(x.w) + '</button>';
    }).join(' ') + '</div>';
}

/* listening helper for practice */
function practiceListen(onFinal, onState) {
  A.stopSpeak();
  A.claimMic('practice');
  var offs = [];
  function done() { offs.forEach(function (f) { f(); }); offs = []; A.releaseMic('practice'); }
  offs.push(Native.on('speech', function (d) {
    if (A.Listen.owner !== 'practice' || typeof d.text !== 'string') return;
    if (d.final) { onFinal(d); }
    else if (onState) onState('partial', d);
  }));
  offs.push(Native.on('listenState', function (d) { if (A.Listen.owner === 'practice' && !d.on) { if (onState) onState('off'); done(); } }));
  offs.push(Native.on('level', function (d) { if (A.Listen.owner === 'practice' && onState) onState('level', d); }));
  return Native.call('listen', { lang: LANG.en.speech, bt: !!S.btMic }).then(function () { if (onState) onState('on'); return done; })
    .catch(function (e) { done(); A.toast(A.errMsg(e)); throw e; });
}

/* =========================================================
   38 + 39 + 41. Practice a sentence: score, record & compare
   ========================================================= */
var practiceIdx = 0;
function practiceScreen(text) {
  var sc = A.openScreen({ title: 'قيّم نطقك', onClose: function () { cleanup(); } });
  var st = { text: text || TJD.practice[practiceIdx % TJD.practice.length], listening: false, rec: false, hasRec: false, stopFn: null };
  var offRec = [];
  function cleanup() {
    if (st.listening) Native.call('stopListen', {}).catch(function () {});
    if (st.rec) Native.call('record', { action: 'stop' }).catch(function () {});
    offRec.forEach(function (f) { f(); });
  }
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="pl-edit" aria-label="اكتب جملتك">' + icon('pen') + '</button>';
  function draw() {
    sc.body.innerHTML = '<div class="pl-card"><div class="pl-sent" dir="ltr" id="plSent">' + st.text.split(/\s+/).map(function (w) {
      return '<button type="button" class="plw" data-act="pl-word" data-w="' + esc(w.replace(/[^A-Za-z'’\-]/g, '')) + '">' + esc(w) + '</button>';
    }).join(' ') + '</div><div class="pl-ipa" dir="ltr" id="plIpa"></div><div class="pl-ar" id="plAr"></div>' +
      '<div class="pl-say"><button type="button" class="pbtn" data-act="pl-say" data-r="1">' + icon('speaker') + '<span>🇺🇸 استمع</span></button>' +
      '<button type="button" class="pbtn" data-act="pl-say" data-r="0.6">' + icon('slow') + '<span>ببطء</span></button>' +
      '<button type="button" class="pbtn" data-act="pl-say" data-r="1" data-uk="1">' + icon('speaker') + '<span>🇬🇧</span></button></div></div>' +
      '<button type="button" class="pl-mic" data-act="pl-mic"><span class="mic-ring"></span><span class="pl-mic-ic">' + icon('mic') + '</span><span class="pl-mic-l">قيّم نطقي</span></button>' +
      '<div id="plRes"></div><div id="plWord"></div>' +
      '<div class="block-h" style="margin-top:16px"><span>سجّل وقارن</span></div><div class="pl-rec">' +
      '<button type="button" class="pbtn" data-act="pl-rec">' + icon('rec') + '<span>سجّل صوتي</span></button>' +
      '<button type="button" class="pbtn" data-act="pl-play" ' + (st.hasRec ? '' : 'disabled') + '>' + icon('play') + '<span>تسجيلي</span></button>' +
      '<button type="button" class="pbtn" data-act="pl-cmp" ' + (st.hasRec ? '' : 'disabled') + '>' + icon('compare') + '<span>الأصل ثم أنا</span></button></div>' +
      '<div class="rec-meter" id="recMeter" hidden><i></i></div>' +
      '<div class="ph-acts" style="justify-content:center;margin-top:18px"><button type="button" class="pbtn" data-act="pl-next">' + icon('repeat') + '<span>جملة ثانية</span></button></div>';
    Pron.load().then(function () {
      var a = Pron.analyze(st.text, 60), s = a.sentences;
      $('#plIpa', sc.body).textContent = s.map(function (x) { return '/' + x.ipa + '/'; }).join(' ');
      if (S.pronAr) $('#plAr', sc.body).textContent = s.map(function (x) { return x.ar; }).join(' ');
    }).catch(function () {});
  }
  draw();
  function setMic(on) {
    st.listening = on;
    var b = $('.pl-mic', sc.body); if (!b) return;
    b.classList.toggle('is-live', on);
    $('.pl-mic-ic', b).innerHTML = icon(on ? 'stop' : 'mic');
    $('.pl-mic-l', b).textContent = on ? 'أسمعك… اقرأ الجملة' : 'قيّم نطقي';
    if (!on) $('.mic-ring', b).style.boxShadow = '';
  }
  A.ACTIONS['pl-mic'] = function () {
    if (st.listening) { Native.call('stopListen', {}).catch(function () {}); return; }
    setMic(true);
    $('#plRes', sc.body).innerHTML = '';
    practiceListen(function (d) {
      var r = scoreSpeech(st.text, d);
      bump('speak');
      $('#plRes', sc.body).innerHTML = scoreHTML(r);
      Native.call('haptic', { style: r.pct >= 75 ? 'success' : 'error' }).catch(function () {});
    }, function (k, d) {
      if (k === 'off') setMic(false);
      else if (k === 'partial') $('#plRes', sc.body).innerHTML = '<div class="pl-partial" dir="ltr">' + esc(d.text) + '</div>';
      else if (k === 'level') { var r = $('.pl-mic .mic-ring', sc.body); if (r) r.style.boxShadow = '0 0 0 ' + (2 + Math.round((d.v || 0) * 14)) + 'px var(--lapis)'; }
    }).catch(function () { setMic(false); });
  };
  A.ACTIONS['pl-say'] = function (b) { A.speak(st.text, 'en', parseFloat(b.getAttribute('data-r')) || 1, b.getAttribute('data-uk') ? { locale: 'en-GB' } : null); };
  A.ACTIONS['pl-word'] = function (b) {
    var w = b.getAttribute('data-w'); if (!w) return;
    A.speak(w, 'en', 0.75);
    Pron.load().then(function () {
      var info = Pron.word(w), box = $('#plWord', sc.body); if (!box) return;
      box.innerHTML = '<div class="extra-card pl-wcard"><div class="pl-wh"><b dir="ltr">' + esc(w) + '</b><button type="button" class="x-close" data-act="pl-wx" aria-label="إغلاق">' + icon('x') + '</button></div>' +
        (info.known ? stressHTML(w) + (S.pronAr ? '<div class="pl-war">' + esc(info.ar) + '</div>' : '') : '<div class="scr-hint" style="margin:0">ما لقيت نطقها.</div>') +
        '<div class="ph-acts" style="margin:10px 0 0"><button type="button" class="pbtn" data-act="say-word" data-say="' + esc(w) + '">' + icon('speaker') + '<span>🇺🇸</span></button>' +
        '<button type="button" class="pbtn" data-act="uu-say" data-v="uk" data-w="' + esc(w) + '">' + icon('speaker') + '<span>🇬🇧</span></button></div></div>';
    });
  };
  A.ACTIONS['pl-wx'] = function () { $('#plWord', sc.body).innerHTML = ''; };
  A.ACTIONS['pl-next'] = function () { practiceIdx++; st.text = TJD.practice[practiceIdx % TJD.practice.length]; st.hasRec = false; draw(); };
  A.ACTIONS['pl-edit'] = function () {
    A.openModal('<h3>جملتك</h3><div class="panel"><div class="field"><textarea id="plIn" dir="ltr" rows="3">' + esc(st.text) + '</textarea></div></div>' +
      '<div class="actions"><button type="button" class="primary ok" data-act="pl-edit-ok">تمرّن عليها</button><button type="button" data-close>إلغاء</button></div>');
  };
  A.ACTIONS['pl-edit-ok'] = function () { var t = $('#plIn').value.trim(); A.closeModal(); if (t) { st.text = t.slice(0, 300); st.hasRec = false; draw(); } };
  /* 39. record & compare */
  offRec.push(Native.on('recLevel', function (d) { var m = $('#recMeter i', sc.body); if (m) m.style.width = Math.round((d.v || 0) * 100) + '%'; }));
  offRec.push(Native.on('recState', function (d) { if (!d.on && st.rec) stopRec(); }));
  function stopRec() {
    st.rec = false;
    Native.call('record', { action: 'stop' }).then(function (r) { st.hasRec = (r && r.duration) > 0.3; refreshRec(); }).catch(function () { refreshRec(); });
  }
  function refreshRec() {
    var b = $('[data-act="pl-rec"]', sc.body); if (!b) return;
    b.classList.toggle('is-live', st.rec);
    b.innerHTML = icon(st.rec ? 'stop' : 'rec') + '<span>' + (st.rec ? 'وقّف التسجيل' : st.hasRec ? 'سجّل مرة ثانية' : 'سجّل صوتي') + '</span>';
    $('#recMeter', sc.body).hidden = !st.rec;
    $$('[data-act="pl-play"], [data-act="pl-cmp"]', sc.body).forEach(function (x) { x.disabled = !st.hasRec || st.rec; });
  }
  A.ACTIONS['pl-rec'] = function () {
    if (st.rec) { stopRec(); return; }
    A.stopSpeak();
    Native.call('record', { action: 'start' }).then(function () { st.rec = true; refreshRec(); }).catch(function (e) { A.toast(A.errMsg(e)); });
  };
  A.ACTIONS['pl-play'] = function () { Native.call('record', { action: 'play' }).catch(function (e) { A.toast(A.errMsg(e)); }); };
  A.ACTIONS['pl-cmp'] = function () {
    var id = 'cmp' + Date.now();
    var off = Native.on('ttsDone', function (d) {
      if (d.id !== id) return;
      off();
      if (d.done) setTimeout(function () { Native.call('record', { action: 'play' }).catch(function () {}); }, 350);
    });
    A.speak(st.text, 'en', 1, { id: id });
  };
}

/* =========================================================
   40. Shadowing
   ========================================================= */
function shadowScreen(text) {
  var list = text ? (String(text).match(/[^.!?؟\n]+[.!?]*/g) || [text]).map(function (s) { return s.trim(); }).filter(function (s) { return /[A-Za-z]/.test(s); })
    : shuffle(TJD.practice).slice(0, 8);
  var st = { i: 0, running: false, phase: '', results: [], rate: 1, stopListen: null, timer: 0, ttsId: '' };
  var sc = A.openScreen({ title: 'تمرين الظل', onClose: function () { stop(); offT(); } });
  sc.body.innerHTML = '<p class="scr-hint">التطبيق يقول الجملة، وأنت تعيدها مباشرة بنفس الإيقاع والنغمة. بعد كل جملة يطلع لك تقييم.</p>' +
    '<div class="pl-card sh-card"><div class="sh-n" id="shN"></div><div class="pl-sent sh-sent" dir="ltr" id="shSent"></div><div class="sh-phase" id="shPhase">جاهز</div><div id="shRes"></div></div>' +
    '<div class="sh-ctrl"><button type="button" class="pl-mic" data-act="sh-go"><span class="mic-ring"></span><span class="pl-mic-ic">' + icon('play') + '</span><span class="pl-mic-l">ابدأ</span></button></div>' +
    '<div class="ph-acts" style="justify-content:center"><button type="button" class="pbtn" data-act="sh-skip">' + icon('back') + '<span>تخطَّ</span></button>' +
    '<button type="button" class="pbtn" data-act="sh-rate">' + icon('slow') + '<span>السرعة: عادية</span></button></div><div class="ct-list" id="shList"></div>';
  function phase(t) { $('#shPhase', sc.body).textContent = t; }
  function showSent() {
    var s = list[st.i];
    $('#shN', sc.body).textContent = (st.i + 1) + ' / ' + list.length;
    $('#shSent', sc.body).textContent = s || '';
  }
  showSent();
  function setBtn() {
    var b = $('[data-act="sh-go"]', sc.body);
    b.classList.toggle('is-live', st.running);
    $('.pl-mic-ic', b).innerHTML = icon(st.running ? 'stop' : 'play');
    $('.pl-mic-l', b).textContent = st.running ? 'وقّف' : (st.i ? 'كمّل' : 'ابدأ');
  }
  var offT = Native.on('ttsDone', function (d) {
    if (!st.running || d.id !== st.ttsId) return;
    if (!d.done) return;
    listen();
  });
  function speakCur() {
    if (!st.running) return;
    if (st.i >= list.length) { finish(); return; }
    showSent();
    $('#shRes', sc.body).innerHTML = '';
    phase('اسمع…');
    st.ttsId = 'sh' + Date.now();
    A.speak(list[st.i], 'en', st.rate, { id: st.ttsId });
  }
  function listen() {
    if (!st.running) return;
    phase('دورك… كرّر الجملة');
    var target = list[st.i];
    practiceListen(function (d) {
      clearTimeout(st.timer);
      var r = scoreSpeech(target, d);
      st.results.push({ s: target, r: r });
      bump('speak');
      $('#shRes', sc.body).innerHTML = scoreHTML(r);
      var li = document.createElement('div'); li.className = 'ct-seg';
      li.innerHTML = '<div class="ct-time">' + r.pct + '٪</div><p class="ct-src" dir="ltr">' + esc(target) + '</p>';
      $('#shList', sc.body).prepend(li);
    }, function (k, d) {
      if (k === 'on') { clearTimeout(st.timer); st.timer = setTimeout(function () { Native.call('stopListen', {}).catch(function () {}); }, 4000 + target.length * 120); }
      if (k === 'level') { var rr = $('[data-act="sh-go"] .mic-ring', sc.body); if (rr) rr.style.boxShadow = '0 0 0 ' + (2 + Math.round((d.v || 0) * 12)) + 'px var(--lapis)'; }
      if (k === 'off') {
        clearTimeout(st.timer);
        var rr2 = $('[data-act="sh-go"] .mic-ring', sc.body); if (rr2) rr2.style.boxShadow = '';
        if (!st.running) return;
        st.i++;
        phase('…');
        setTimeout(speakCur, 1300);
      }
    }).catch(function () { st.running = false; setBtn(); phase('توقف'); });
  }
  function finish() {
    st.running = false; setBtn();
    var avg = st.results.length ? Math.round(st.results.reduce(function (a, x) { return a + x.r.pct; }, 0) / st.results.length) : 0;
    phase('خلصت! معدلك ' + avg + '٪');
    $('#shSent', sc.body).textContent = '';
    $('#shN', sc.body).textContent = '';
    st.i = 0;
  }
  function stop() {
    st.running = false; clearTimeout(st.timer);
    if (A.Listen.owner === 'practice') Native.call('stopListen', {}).catch(function () {});
    A.stopSpeak();
  }
  A.ACTIONS['sh-go'] = function () {
    if (st.running) { stop(); setBtn(); phase('متوقف'); return; }
    if (!st.i) { st.results = []; $('#shList', sc.body).innerHTML = ''; }
    st.running = true; setBtn(); speakCur();
  };
  A.ACTIONS['sh-skip'] = function () {
    var was = st.running; stop();
    st.i = Math.min(list.length - 1, st.i + 1); showSent();
    if (was) { st.running = true; setTimeout(speakCur, 300); }
    setBtn();
  };
  A.ACTIONS['sh-rate'] = function (b) {
    st.rate = st.rate === 1 ? 0.75 : st.rate === 0.75 ? 0.55 : 1;
    $('span', b).textContent = 'السرعة: ' + (st.rate === 1 ? 'عادية' : st.rate === 0.75 ? 'أبطأ' : 'بطيئة');
  };
}

/* =========================================================
   43. Minimal pairs
   ========================================================= */
function pairsScreen() {
  var sc = A.openScreen({ title: 'أصوات متشابهة', onClose: function () { if (A.Listen.owner === 'practice') Native.call('stopListen', {}).catch(function () {}); } });
  function home() {
    sc.body.innerHTML = '<p class="scr-hint">أصوات إنجليزية يخلط بينها المتحدث بالعربي. اختر مجموعة وتدرّب تسمع الفرق وتنطقه.</p><div class="panel">' +
      TJD.minimalPairs.map(function (g) {
        return '<div class="row choice" data-act="mp-open" data-id="' + g.id + '"><div class="r-main"><div class="r-title" dir="auto">' + esc(g.title) + '</div><div class="r-sub" dir="ltr">' +
          esc(g.pairs.slice(0, 3).map(function (p) { return p.join(' / '); }).join(' · ')) + '</div></div><span class="link-btn">تمرّن</span></div>';
      }).join('') + '</div>';
  }
  function group(id) {
    var g = TJD.minimalPairs.filter(function (x) { return x.id === id; })[0]; if (!g) return;
    sc.body.innerHTML = '<div class="ph-acts"><button type="button" class="pbtn" data-act="mp-home">' + icon('back') + '<span>المجموعات</span></button></div>' +
      '<div class="conf-box" style="margin-top:0"><div class="conf-h">' + icon('bulb') + '<b dir="auto">' + esc(g.title) + '</b></div><div class="conf-t">' + esc(g.tip) + '</div></div>' +
      '<div class="seg" id="mpMode"><button type="button" class="is-on" data-m="hear">اسمع واختر</button><button type="button" data-m="say">قلها أنت</button></div><div id="mpBody"></div>';
    var mode = 'hear';
    $('#mpMode', sc.body).addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('#mpMode button', sc.body).forEach(function (x) { x.classList.toggle('is-on', x === b); });
      mode = b.getAttribute('data-m'); mode === 'hear' ? hear() : say();
    });
    /* listen and choose */
    var round = 0, right = 0, curW = '', curPair = null;
    function hear() {
      round = 0; right = 0; nextQ();
    }
    function nextQ() {
      if (round >= 10) {
        $('#mpBody', sc.body).innerHTML = '<div class="qz-res"><div class="qz-score">' + right + ' / 10</div><div class="qz-msg">' + (right >= 9 ? 'أذنك ممتازة 👂' : right >= 7 ? 'زين جدًا' : 'تحتاج تسمع أكثر') + '</div></div>' +
          '<div class="ph-acts" style="justify-content:center"><button type="button" class="pbtn" data-act="mp-again">' + icon('repeat') + '<span>مرة ثانية</span></button></div>';
        return;
      }
      curPair = g.pairs[Math.floor(Math.random() * g.pairs.length)];
      curW = curPair[Math.random() < 0.5 ? 0 : 1];
      $('#mpBody', sc.body).innerHTML = '<div class="fc-prog"><div class="bt-bar"><i style="width:' + (round * 10) + '%"></i></div><span>' + (round + 1) + ' / 10</span></div>' +
        '<div class="qz-q"><span>وش الكلمة اللي سمعتها؟</span><button type="button" class="ic qz-say" data-act="mp-play" aria-label="استمع">' + icon('speaker') + '</button></div>' +
        '<div class="qz-opts mp-opts">' + curPair.map(function (w) { return '<button type="button" class="qz-o en" data-act="mp-pick" data-w="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div><div id="mpFb"></div>';
      setTimeout(function () { A.speak(curW, 'en', 0.85); }, 250);
    }
    A.ACTIONS['mp-play'] = function () { A.speak(curW, 'en', 0.8); };
    A.ACTIONS['mp-again'] = function () { hear(); };
    A.ACTIONS['mp-pick'] = function (b) {
      if (b.disabled) return;
      var ok = b.getAttribute('data-w') === curW;
      $$('.mp-opts .qz-o', sc.body).forEach(function (x) { x.disabled = true; if (x.getAttribute('data-w') === curW) x.classList.add('ok'); else if (x === b) x.classList.add('bad'); });
      if (ok) right++;
      round++; bump('quiz'); if (ok) bump('quizOk');
      Native.call('haptic', { style: ok ? 'success' : 'error' }).catch(function () {});
      $('#mpFb', sc.body).innerHTML = '<div class="mp-cmp" dir="ltr">' + curPair.map(function (w) { return '<button type="button" class="pbtn" data-act="say-word" data-say="' + esc(w) + '">' + icon('speaker') + '<span>' + esc(w) + '</span></button>'; }).join('') + '</div>' +
        '<div class="fc-acts"><button type="button" class="fc-show" data-act="mp-next">التالي</button></div>';
    };
    A.ACTIONS['mp-next'] = function () { nextQ(); };
    /* say it */
    function say() {
      $('#mpBody', sc.body).innerHTML = '<p class="scr-hint">اضغط على كلمة وقلها. التطبيق يقولك وش سمع.</p><div class="mp-say">' + g.pairs.map(function (p) {
        return '<div class="mp-row" dir="ltr">' + p.map(function (w) { return '<button type="button" class="mp-w" data-act="mp-say" data-w="' + esc(w) + '"><b>' + esc(w) + '</b><span class="mp-r"></span></button>'; }).join('') + '</div>';
      }).join('') + '</div>';
    }
    A.ACTIONS['mp-say'] = function (b) {
      if (A.Listen.owner === 'practice') { Native.call('stopListen', {}).catch(function () {}); return; }
      var w = b.getAttribute('data-w'), out = $('.mp-r', b);
      $$('.mp-w', sc.body).forEach(function (x) { x.classList.remove('is-live'); });
      b.classList.add('is-live'); out.textContent = '🎙️';
      var got = false;
      practiceListen(function (d) {
        got = true;
        var heard = String(d.text || '').toLowerCase().replace(/[^a-z' ]/g, '').trim();
        var ok = heard.split(/\s+/).indexOf(w.toLowerCase()) >= 0;
        b.classList.remove('is-live'); b.classList.toggle('good', ok); b.classList.toggle('bad', !ok);
        out.textContent = ok ? '✓' : (heard ? 'سمعت: ' + heard : 'ما سمعت');
        bump('speak');
        setTimeout(function () { Native.call('stopListen', {}).catch(function () {}); }, 100);
      }, function (k) {
        if (k === 'on') setTimeout(function () { if (!got) Native.call('stopListen', {}).catch(function () {}); }, 3500);
        if (k === 'off') { b.classList.remove('is-live'); if (!got) out.textContent = 'ما سمعت، جرّب مرة ثانية'; }
      }).catch(function () { b.classList.remove('is-live'); out.textContent = ''; });
    };
    hear();
  }
  A.ACTIONS['mp-open'] = function (b) { group(b.getAttribute('data-id')); };
  A.ACTIONS['mp-home'] = function () { home(); };
  home();
}

/* =========================================================
   44. Connected speech
   ========================================================= */
function connectedScreen() {
  var sc = A.openScreen({ title: 'الكلام السريع' });
  sc.body.innerHTML = '<p class="scr-hint">الأمريكان بالكلام العادي يدمجون الكلمات. اعرفها عشان تفهمهم، واسمع الجملة بالسرعة الطبيعية ثم ببطء.</p>' +
    TJD.connected.map(function (c) {
      return '<div class="cs-row"><div class="cs-top" dir="ltr"><span class="cs-f">' + esc(c[0]) + '</span><span class="cs-arrow">→</span><b class="cs-c">' + esc(c[1]) + '</b><span class="cs-ar" dir="rtl">' + esc(c[2]) + '</span></div>' +
        '<div class="cs-ex" dir="ltr"><span>' + esc(c[3]) + '</span><button type="button" class="ic sm" data-act="cs-say" data-t="' + esc(c[3]) + '" data-r="1.1" aria-label="بالسرعة الطبيعية">' + icon('speaker') + '</button>' +
        '<button type="button" class="ic sm" data-act="cs-say" data-t="' + esc(c[3]) + '" data-r="0.6" aria-label="ببطء">' + icon('slow') + '</button></div></div>';
    }).join('');
}
A.ACTIONS['cs-say'] = function (b) {
  var t = b.getAttribute('data-t').replace(/\bwanna\b/gi, 'want to').replace(/\bgonna\b/gi, 'going to').replace(/\bgotta\b/gi, 'got to').replace(/\bhafta\b/gi, 'have to')
    .replace(/\bkinda\b/gi, 'kind of').replace(/\bsorta\b/gi, 'sort of').replace(/\blemme\b/gi, 'let me').replace(/\bgimme\b/gi, 'give me').replace(/\bdunno\b/gi, "don't know")
    .replace(/\bwhaddaya\b/gi, 'what do you').replace(/\bdidja\b/gi, 'did you').replace(/\bwouldja\b/gi, 'would you').replace(/\bcoulda\b/gi, 'could have').replace(/\bshoulda\b/gi, 'should have')
    .replace(/\bwoulda\b/gi, 'would have').replace(/\blotta\b/gi, 'lot of').replace(/\boutta\b/gi, 'out of').replace(/\bwhatcha\b/gi, 'what are you').replace(/\bbetcha\b/gi, 'bet you')
    .replace(/\boughta\b/gi, 'ought to').replace(/\bhowya doin\b/gi, 'how are you doing').replace(/\by'all\b/gi, 'you all').replace(/\bc'mon\b/gi, 'come on').replace(/'cause/gi, 'because');
  var fast = parseFloat(b.getAttribute('data-r')) > 1;
  // the casual text often reads better to TTS as written; the slow version uses the full form
  A.speak(fast ? b.getAttribute('data-t') : t, 'en', parseFloat(b.getAttribute('data-r')) || 1);
};

/* =========================================================
   Lab home + entry points
   ========================================================= */
function labScreen() {
  var sc = A.openScreen({ title: 'مختبر النطق' });
  var items = [
    ['score', 'mic', 'قيّم نطقك', 'اقرأ جملة ويعطيك درجة ويحدد الكلمات الغلط، وسجّل صوتك وقارنه'],
    ['shadow', 'repeat', 'تمرين الظل', 'يقول الجملة وأنت تكررها وراه مباشرة'],
    ['pairs', 'wave', 'أصوات متشابهة', 'ship / sheep، pin / bin، fan / van'],
    ['connected', 'listen', 'الكلام السريع', 'wanna، gonna، gotta وغيرها'],
    ['usuk', 'globe', 'أمريكي وبريطاني', 'نفس الكلمة بلهجتين']
  ];
  sc.body.innerHTML = '<div class="tiles">' + items.map(function (t) {
    return '<button type="button" class="tile" data-act="lab-open" data-id="' + t[0] + '"><span class="tile-ic">' + icon(t[1]) + '</span><b>' + esc(t[2]) + '</b><small dir="auto">' + esc(t[3]) + '</small></button>';
  }).join('') + '</div><p class="scr-hint" style="margin-top:14px">التقييم يستخدم التعرّف على الكلام من آبل: لو فهم كلامك صح، غالبًا نطقك واضح. الكلمات الحمراء ما فهمها، والبرتقالية فهمها بصعوبة.</p>';
}
A.ACTIONS['lab-open'] = function (b) {
  var id = b.getAttribute('data-id');
  if (id === 'score') practiceScreen();
  else if (id === 'shadow') shadowScreen();
  else if (id === 'pairs') pairsScreen();
  else if (id === 'connected') connectedScreen();
  else usUkScreen();
};
if (A.addLearnTile) A.addLearnTile({ id: 'pron', label: 'مختبر النطق', sub: 'قيّم نطقك وتمرّن', icon: 'mic', order: 5, run: labScreen });
A.addResultAction({ id: 'practice', label: 'تمرّن على نطقها', sub: 'اقرأ النص الإنجليزي وخذ درجة على نطقك', icon: 'mic', order: 17,
  when: function (r) { return (r.sl === 'en' || r.tl === 'en') && (r.sl === 'en' ? r.source : r.text).length <= 300; },
  run: function (r) { practiceScreen(r.sl === 'en' ? r.source : r.text); } });
A.MORE_ROUTES = Object.assign(A.MORE_ROUTES || {}, {
  pron: function () { A.showView('learn'); labScreen(); },
  practice: function (p) { A.showView('learn'); practiceScreen(p && p.text); },
  shadow: function () { A.showView('learn'); shadowScreen(); }
});
A.PronLab = { score: scoreSpeech, spellSylls: spellSylls, ukIPA: ukIPA, stressHTML: stressHTML, practice: practiceScreen, shadow: shadowScreen };
})();
