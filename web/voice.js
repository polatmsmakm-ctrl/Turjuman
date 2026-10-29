'use strict';
/* Voice features: face-to-face conversation (11), continuous listening (12), auto language detection (13),
   audio/video transcription (14), AirPods (15), saved conversations (16), YouTube captions (17). */
(function () {
var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, S = A.S, Store = A.Store, Native = A.Native, LANG = A.LANG;

function fmtDur(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
function canSpeech(l) { return !!(LANG[l] && LANG[l].speech); }
function listenOpts() { return { bt: !!S.btMic }; }
A.hookAdd('listenOpts', function () { return listenOpts(); });

/* =========================================================
   16. Saved conversations store
   ========================================================= */
var CONVOS = Store.get('convos', []);
function saveConvos() { Store.set('convos', CONVOS.slice(0, 100)); }
function addConvo(c) { if (!c.turns.length) return; CONVOS.unshift(c); saveConvos(); }

/* =========================================================
   11. Face-to-face conversation
   ========================================================= */
function convoScreen() {
  var me = S.pairA === 'ar' || S.pairB === 'ar' ? 'ar' : S.pairA;
  var them = me === S.pairA ? S.pairB : S.pairA;
  var st = { a: me, b: them, turns: [], active: null, autoSpeak: true, id: Date.now().toString(36), ts: Date.now() };
  var sc = A.openScreen({ title: 'محادثة', cls: 'convo-scr', onClose: function () {
    if (st.active) Native.call('cancelListen', {}).catch(function () {});
    A.releaseMic('convo');
    if (st.turns.length) addConvo({ id: st.id, ts: st.ts, a: st.a, b: st.b, turns: st.turns, kind: 'convo' });
  } });
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="cv-speak" aria-label="النطق التلقائي">' + icon('speaker') + '</button>' +
    '<button type="button" class="ic" data-act="cv-langs" aria-label="اللغات">' + icon('translate') + '</button>';
  function half(side) {
    var l = st[side];
    return '<section class="cv-half cv-' + side + '" data-side="' + side + '">' +
      '<div class="cv-head"><span class="cv-lang">' + esc(LANG[l].name) + '</span><span class="cv-sub">' + (side === 'a' ? 'أنت' : 'الطرف الثاني') + '</span></div>' +
      '<div class="cv-text"><p class="cv-said ' + A.styleClass(l) + '" dir="auto"></p><p class="cv-tr ' + A.styleClass(l) + '" dir="auto"></p></div>' +
      '<button type="button" class="cv-mic" data-act="cv-mic" data-side="' + side + '"><span class="mic-ring"></span><span class="cv-mic-ic">' + icon('mic') + '</span><span>' + esc(LANG[l].name) + '</span></button>' +
      '</section>';
  }
  function draw() {
    sc.body.innerHTML = '<div class="cv">' + half('b') + '<div class="cv-mid"><span>اضغط زر لغتك وتكلّم، والترجمة تطلع عند الطرف الثاني وتنقرأ له</span></div>' + half('a') + '</div>';
    sc.body.classList.add('cv-body');
  }
  draw();
  function halfEl(side) { return $('.cv-half[data-side="' + side + '"]', sc.body); }
  function setLive(side) {
    $$('.cv-mic', sc.body).forEach(function (b) {
      var on = b.getAttribute('data-side') === side;
      b.classList.toggle('is-live', on);
      $('.cv-mic-ic', b).innerHTML = icon(on ? 'stop' : 'mic');
      if (!on) $('.mic-ring', b).style.boxShadow = '';
    });
  }
  var lastPartialTr = 0;
  function onSpeech(d) {
    if (A.Listen.owner !== 'convo' || !st.active || typeof d.text !== 'string') return;
    var side = st.active, other = side === 'a' ? 'b' : 'a';
    var sl = st[side], tl = st[other];
    $('.cv-said', halfEl(side)).textContent = d.text;
    var trEl = $('.cv-tr', halfEl(other));
    if (!d.final) {
      var now = Date.now();
      if (now - lastPartialTr > 600) {
        lastPartialTr = now;
        A.translateWith('google', d.text, sl, tl).then(function (r) { if (st.active === side) { trEl.textContent = r.text; trEl.classList.add('is-preview'); } }).catch(function () {});
      }
      return;
    }
    st.active = null; setLive(null);
    A.translateWith(S.engine, d.text, sl, tl).catch(function () { return A.translateWith('google', d.text, sl, tl); }).then(function (r) {
      trEl.textContent = r.text; trEl.classList.remove('is-preview');
      $('.cv-said', halfEl(other)).textContent = '';
      st.turns.push({ side: side, lang: sl, text: d.text, tr: r.text, tl: tl, ts: Date.now() });
      if (st.autoSpeak) A.speak(r.text, tl);
    }).catch(function (e) { trEl.textContent = A.errMsg(e); });
  }
  function onState(d) {
    if (A.Listen.owner !== 'convo') return;
    if (!d.on) { st.active = null; setLive(null); A.releaseMic('convo'); }
  }
  function onLevel(d) {
    if (A.Listen.owner !== 'convo' || !st.active) return;
    var ring = $('.cv-mic[data-side="' + st.active + '"] .mic-ring', sc.body);
    if (ring) ring.style.boxShadow = '0 0 0 ' + (2 + Math.round((d.v || 0) * 14)) + 'px var(--lapis)';
  }
  var offs = [Native.on('speech', onSpeech), Native.on('listenState', onState), Native.on('level', onLevel)];
  A.ACTIONS['cv-mic'] = function (b) {
    var side = b.getAttribute('data-side');
    if (st.active === side) { Native.call('stopListen', {}).catch(function () {}); return; }
    if (!canSpeech(st[side])) { A.toast('التكلم غير مدعوم لهذي اللغة'); return; }
    A.stopSpeak(); A.haptic();
    A.claimMic('convo');
    st.active = side; setLive(side);
    $('.cv-said', halfEl(side)).textContent = '';
    Native.call('listen', Object.assign({ lang: LANG[st[side]].speech }, listenOpts())).catch(function (e) {
      st.active = null; setLive(null); A.releaseMic('convo'); A.toast(A.errMsg(e));
    });
  };
  A.ACTIONS['cv-speak'] = function (b) { st.autoSpeak = !st.autoSpeak; b.classList.toggle('is-on', st.autoSpeak); A.toast(st.autoSpeak ? 'الترجمة تنقرأ تلقائيًا' : 'النطق التلقائي متوقف'); };
  A.ACTIONS['cv-langs'] = function () {
    A.openModal('<h3>لغة كل طرف</h3><div class="field"><div class="f-label"><span>أنت تتكلم</span></div><select id="cvA">' + langOptions(st.a) + '</select></div>' +
      '<div class="field"><div class="f-label"><span>الطرف الثاني يتكلم</span></div><select id="cvB">' + langOptions(st.b) + '</select></div>' +
      '<div class="actions"><button type="button" class="primary ok" data-act="cv-langs-ok">تم</button><button type="button" data-close>إلغاء</button></div>');
  };
  A.ACTIONS['cv-langs-ok'] = function () {
    var a = $('#cvA').value, b = $('#cvB').value; A.closeModal();
    if (a === b) { A.toast('اختر لغتين مختلفتين'); return; }
    st.a = a; st.b = b; draw();
  };
  $('[data-act="cv-speak"]', sc.actions).classList.add('is-on');
  Native.call('keepAwake', { on: true }).catch(function () {});
  var oc = sc.o.onClose; sc.o.onClose = function () { Native.call('keepAwake', { on: false }).catch(function () {}); offs.forEach(function (f) { f(); }); oc(); };
}
function langOptions(sel, speechOnly) {
  return A.LANG_ORDER.filter(function (l) { return !speechOnly || canSpeech(l); }).map(function (l) {
    return '<option value="' + l + '"' + (l === sel ? ' selected' : '') + '>' + LANG[l].ar + ' (' + LANG[l].name + ')</option>';
  }).join('');
}

/* =========================================================
   12. Continuous listening (lectures, meetings)
   ========================================================= */
function continuousScreen() {
  var st = { sl: A.T.src, tl: A.T.tgt, segs: [], running: false, started: 0, timer: 0, id: Date.now().toString(36), ts: Date.now() };
  var sc = A.openScreen({ title: 'استماع مستمر', onClose: function () {
    if (st.running) Native.call('stopListen', {}).catch(function () {});
    Native.call('keepAwake', { on: false }).catch(function () {});
    clearInterval(st.timer); A.releaseMic('cont');
    if (st.segs.length) addConvo({ id: st.id, ts: st.ts, a: st.sl, b: st.tl, kind: 'lecture', turns: st.segs.map(function (g) { return { side: 'a', lang: st.sl, text: g.text, tr: g.tr || '', tl: st.tl, ts: g.ts }; }) });
  } });
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="ct-copy" aria-label="نسخ الكل">' + icon('copy') + '</button>' +
    '<button type="button" class="ic" data-act="ct-share" aria-label="مشاركة">' + icon('share') + '</button>';
  sc.body.innerHTML =
    '<div class="ct-top"><div class="field"><div class="f-label"><span>المتكلم يتكلم</span></div><select id="ctSl">' + langOptions(st.sl, true) + '</select></div>' +
    '<div class="field"><div class="f-label"><span>الترجمة إلى</span></div><select id="ctTl">' + langOptions(st.tl) + '</select></div></div>' +
    '<div class="ct-ctrl"><button type="button" class="ct-btn" data-act="ct-toggle"><span class="mic-ring"></span><span class="ct-ic">' + icon('mic') + '</span><span class="ct-lbl">ابدأ</span></button>' +
    '<div class="ct-meta"><b id="ctTime">0:00</b><span id="ctCount">0 مقطع</span></div></div>' +
    '<p class="scr-hint">يسمع بشكل متواصل، وكل ما يسكت المتكلم لحظة يطلع المقطع مترجم. الشاشة تبقى شغالة لين توقف.</p>' +
    '<div class="ct-list" id="ctList"></div><div class="ct-live" id="ctLive" hidden><p class="ct-src" dir="auto"></p><p class="ct-tr" dir="auto"></p></div>';
  var list = $('#ctList', sc.body), live = $('#ctLive', sc.body);
  function addSeg(text) {
    var g = { text: text, tr: '', ts: Date.now() };
    st.segs.push(g);
    var el = document.createElement('div');
    el.className = 'ct-seg';
    el.innerHTML = '<div class="ct-time">' + fmtDur((g.ts - st.started) / 1000) + '</div><p class="ct-src" dir="auto">' + esc(text) + '</p><p class="ct-tr ' + A.styleClass(st.tl) + '" dir="auto">…</p>';
    list.appendChild(el);
    $('#ctCount', sc.body).textContent = st.segs.length + ' مقطع';
    A.translateWith(S.engine === 'claude' ? 'claude' : 'google', text, st.sl, st.tl).catch(function () { return A.translateWith('google', text, st.sl, st.tl); }).then(function (r) {
      g.tr = r.text; $('.ct-tr', el).textContent = r.text;
    }).catch(function (e) { $('.ct-tr', el).textContent = A.errMsg(e); });
    sc.body.scrollTop = sc.body.scrollHeight;
  }
  var lastP = 0;
  function onSpeech(d) {
    if (A.Listen.owner !== 'cont' || typeof d.text !== 'string') return;
    if (d.final) { live.hidden = true; if (d.text.trim()) addSeg(d.text.trim()); return; }
    live.hidden = false;
    $('.ct-src', live).textContent = d.text;
    var now = Date.now();
    if (now - lastP > 900) {
      lastP = now;
      A.translateWith('google', d.text, st.sl, st.tl).then(function (r) { if (!live.hidden) { $('.ct-tr', live).textContent = r.text; } }).catch(function () {});
    }
    sc.body.scrollTop = sc.body.scrollHeight;
  }
  function setRunning(on) {
    st.running = on;
    var b = $('.ct-btn', sc.body);
    b.classList.toggle('is-live', on);
    $('.ct-ic', b).innerHTML = icon(on ? 'stop' : 'mic');
    $('.ct-lbl', b).textContent = on ? 'إيقاف' : (st.segs.length ? 'كمّل' : 'ابدأ');
    if (!on) $('.mic-ring', b).style.boxShadow = '';
    clearInterval(st.timer);
    if (on) st.timer = setInterval(function () { $('#ctTime', sc.body).textContent = fmtDur((Date.now() - st.started) / 1000); }, 1000);
    Native.call('keepAwake', { on: on }).catch(function () {});
  }
  var offs = [Native.on('speech', onSpeech),
    Native.on('listenState', function (d) { if (A.Listen.owner === 'cont' && !d.on) { setRunning(false); A.releaseMic('cont'); } }),
    Native.on('level', function (d) {
      if (A.Listen.owner !== 'cont' || !st.running) return;
      var r = $('.ct-btn .mic-ring', sc.body); if (r) r.style.boxShadow = '0 0 0 ' + (2 + Math.round((d.v || 0) * 16)) + 'px var(--lapis)';
    })];
  var oc = sc.o.onClose; sc.o.onClose = function () { offs.forEach(function (f) { f(); }); oc(); };
  A.ACTIONS['ct-toggle'] = function () {
    if (st.running) { Native.call('stopListen', {}).catch(function () {}); return; }
    st.sl = $('#ctSl', sc.body).value; st.tl = $('#ctTl', sc.body).value;
    if (st.sl === st.tl) { A.toast('اختر لغتين مختلفتين'); return; }
    if (!st.started) st.started = Date.now();
    A.stopSpeak(); A.claimMic('cont');
    Native.call('listen', Object.assign({ lang: LANG[st.sl].speech, mode: 'continuous' }, listenOpts())).then(function () { setRunning(true); })
      .catch(function (e) { A.releaseMic('cont'); A.toast(A.errMsg(e)); });
  };
  function allText() { return st.segs.map(function (g) { return g.text + '\n' + (g.tr || ''); }).join('\n\n'); }
  A.ACTIONS['ct-copy'] = function () { Native.call('copy', { text: allText() }).catch(function () {}); A.toast('نُسخ النص كامل'); };
  A.ACTIONS['ct-share'] = function () { Native.call('share', { file: { name: 'ترجمان-استماع.txt', text: allText() } }).catch(function () {}); };
}

/* =========================================================
   13. Auto-detect spoken language (main translate view)
   ========================================================= */
var autoSt = { on: false, parts: {} };
function dockNote(html) { var n = $('#dockNote'); if (!html) { n.hidden = true; n.innerHTML = ''; return; } n.innerHTML = '<span>' + html + '</span>'; n.hidden = false; }
function setAutoLive(on) {
  autoSt.on = on;
  var b = $('#micAuto');
  b.classList.toggle('is-live', on);
  $('.mic-ic', b).innerHTML = icon(on ? 'stop' : 'mic');
  if (!on) $('.mic-ring', b).style.boxShadow = '';
}
$('#micAuto').addEventListener('click', function () {
  if (autoSt.on) { Native.call('stopListen', {}).catch(function () {}); return; }
  var a = S.pairA, b = S.pairB;
  if (!canSpeech(a) || !canSpeech(b)) { A.toast('الاكتشاف التلقائي يحتاج لغتين يدعمهم التعرف على الكلام'); return; }
  A.stopSpeak(); A.haptic();
  A.claimMic('auto');
  autoSt.parts = {};
  setAutoLive(true);
  dockNote('أسمعك… تكلّم ' + LANG[a].ar + ' أو ' + LANG[b].ar);
  Native.call('listen', Object.assign({ langs: [LANG[a].speech, LANG[b].speech], mode: 'auto' }, listenOpts())).catch(function (e) {
    setAutoLive(false); dockNote(''); A.releaseMic('auto'); A.toast(A.errMsg(e));
  });
});
Native.on('speech', function (d) {
  if (A.Listen.owner !== 'auto' || typeof d.text !== 'string') return;
  var l = A.langFromLocale(d.lang);
  if (!d.final) {
    autoSt.parts[l] = d.text;
    var words = Object.keys(autoSt.parts).map(function (k) { return '<b>' + esc(LANG[k] ? LANG[k].name : k) + ':</b> ' + esc(autoSt.parts[k].slice(-40)); });
    dockNote(words.join(' &nbsp; '));
    return;
  }
  dockNote('');
  if (!l) return;
  A.showView('translate');
  A.setDir(l);
  A.srcEl.value = d.text; A.autoGrow(); A.updateCount();
  A.T.sessionId = null; A.T.partial = false; A.T.speakWhenDone = S.autoSpeak;
  A.resetOutput(); A.srcEl.value = d.text;
  A.scheduleTranslate(true);
  A.toast('عرفت إنك تتكلم ' + LANG[l].ar);
});
Native.on('listenState', function (d) { if (A.Listen.owner === 'auto' && !d.on) { setAutoLive(false); A.releaseMic('auto'); setTimeout(function () { if (!autoSt.on) dockNote(''); }, 400); } });
Native.on('level', function (d) {
  if (A.Listen.owner !== 'auto' || !autoSt.on) return;
  var r = $('#micAuto .mic-ring'); if (r) r.style.boxShadow = '0 0 0 ' + (2 + Math.round((d.v || 0) * 10)) + 'px var(--lapis)';
});

/* =========================================================
   14. Transcribe & translate audio / video files
   ========================================================= */
function fileScreen() {
  var st = { sl: A.T.src, tl: A.T.tgt, segs: [], busy: false };
  var sc = A.openScreen({ title: 'ترجمة ملف صوتي أو فيديو', onClose: function () { if (st.busy) Native.call('transcribeCancel', {}).catch(function () {}); } });
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="tf-copy" aria-label="نسخ">' + icon('copy') + '</button><button type="button" class="ic" data-act="tf-share" aria-label="مشاركة">' + icon('share') + '</button>';
  sc.body.innerHTML = '<div class="ct-top"><div class="field"><div class="f-label"><span>لغة الكلام في الملف</span></div><select id="tfSl">' + langOptions(st.sl, true) + '</select></div>' +
    '<div class="field"><div class="f-label"><span>الترجمة إلى</span></div><select id="tfTl">' + langOptions(st.tl) + '</select></div></div>' +
    '<div class="tf-pick"><button type="button" class="big-btn" data-act="tf-pick" data-src="files">' + icon('folder') + '<span>من الملفات</span></button>' +
    '<button type="button" class="big-btn" data-act="tf-pick" data-src="photos">' + icon('video') + '<span>فيديو من الصور</span></button></div>' +
    '<p class="scr-hint">يقبل ملفات الصوت (تسجيلات، رسائل صوتية، بودكاست) والفيديو. الملف ينقسم مقاطع كل 50 ثانية وكل مقطع ينكتب ويترجم.</p>' +
    '<div class="tf-prog" id="tfProg" hidden><div class="bt-bar"><i></i></div><span></span></div><div class="ct-list" id="tfList"></div>';
  var list = $('#tfList', sc.body), prog = $('#tfProg', sc.body);
  function onProgress(d) {
    if (!st.busy) return;
    prog.hidden = false;
    $('i', prog).style.width = Math.round(100 * d.done / d.total) + '%';
    $('span', prog).textContent = 'جاري الكتابة… ' + d.done + ' من ' + d.total;
    if (d.text) {
      var g = { start: d.start, text: d.text, tr: '' }; st.segs.push(g);
      var el = document.createElement('div'); el.className = 'ct-seg';
      el.innerHTML = '<div class="ct-time">' + fmtDur(d.start) + '</div><p class="ct-src" dir="auto">' + esc(d.text) + '</p><p class="ct-tr ' + A.styleClass(st.tl) + '" dir="auto">…</p>';
      list.appendChild(el);
      A.translateMany([d.text], st.sl, st.tl).then(function (o) { g.tr = o[0]; $('.ct-tr', el).textContent = o[0]; }).catch(function () { $('.ct-tr', el).textContent = ''; });
    }
  }
  var offP = Native.on('transcribeProgress', onProgress);
  var oc = sc.o.onClose; sc.o.onClose = function () { offP(); oc(); };
  A.ACTIONS['tf-pick'] = function (b) {
    if (st.busy) return;
    st.sl = $('#tfSl', sc.body).value; st.tl = $('#tfTl', sc.body).value;
    st.segs = []; list.innerHTML = ''; st.busy = true;
    Native.call('transcribeFile', { lang: LANG[st.sl].speech, source: b.getAttribute('data-src') }).then(function (r) {
      st.busy = false;
      if (r && r.cancelled && !st.segs.length) { prog.hidden = true; return; }
      $('span', prog).textContent = st.segs.length ? 'خلص: ' + fmtDur(r.duration || 0) + ' من الكلام' : 'ما لقيت كلام واضح في الملف';
      $('i', prog).style.width = '100%';
    }).catch(function (e) { st.busy = false; prog.hidden = true; A.toast(A.errMsg(e)); });
  };
  function allText() { return st.segs.map(function (g) { return '[' + fmtDur(g.start) + '] ' + g.text + '\n' + g.tr; }).join('\n\n'); }
  A.ACTIONS['tf-copy'] = function () { Native.call('copy', { text: allText() }).catch(function () {}); A.toast('نُسخ'); };
  A.ACTIONS['tf-share'] = function () { Native.call('share', { file: { name: 'ترجمان-نص-الملف.txt', text: allText() } }).catch(function () {}); };
}

/* =========================================================
   17. YouTube captions
   ========================================================= */
function ytId(u) {
  var m = String(u).match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(u) ? u : null);
}
function extractJSON(html, marker) {
  var i = html.indexOf(marker); if (i < 0) return null;
  i = html.indexOf('{', i); if (i < 0) return null;
  var depth = 0, inStr = false, esc2 = false;
  for (var j = i; j < html.length; j++) {
    var c = html[j];
    if (inStr) { if (esc2) esc2 = false; else if (c === '\\') esc2 = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { try { return JSON.parse(html.slice(i, j + 1)); } catch (e) { return null; } } }
  }
  return null;
}
async function ytCaptions(id) {
  var hdr = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', 'Accept-Language': 'en,ar;q=0.8', 'Cookie': 'CONSENT=YES+1' };
  var r = await A.http('https://www.youtube.com/watch?v=' + id + '&hl=en', { headers: hdr, timeout: 25 });
  if (r.status >= 400) throw A.err('yt_blocked');
  var pr = extractJSON(r.body, 'ytInitialPlayerResponse');
  if (!pr) throw A.err('yt_blocked');
  var title = (pr.videoDetails && pr.videoDetails.title) || '';
  var tracks = (((pr.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
  if (!tracks.length) throw A.err('yt_nocaps');
  return { title: title, tracks: tracks.map(function (t) { return { url: t.baseUrl, lang: t.languageCode, name: (t.name && (t.name.simpleText || (t.name.runs && t.name.runs[0] && t.name.runs[0].text))) || t.languageCode, auto: t.kind === 'asr' }; }) };
}
async function ytTrack(url) {
  var r = await A.http(url + (url.indexOf('fmt=') < 0 ? '&fmt=json3' : ''), { timeout: 25 });
  if (r.status >= 400 || !r.body) throw A.err('yt_blocked');
  var segs = [];
  try {
    var j = JSON.parse(r.body);
    (j.events || []).forEach(function (ev) {
      if (!ev.segs) return;
      var t = ev.segs.map(function (s) { return s.utf8 || ''; }).join('').replace(/\s+/g, ' ').trim();
      if (t) segs.push({ start: (ev.tStartMs || 0) / 1000, text: t });
    });
  } catch (e) {
    var doc = new DOMParser().parseFromString(r.body, 'text/xml');
    $$('text', doc).forEach(function (n) { var t = (n.textContent || '').replace(/\s+/g, ' ').trim(); if (t) segs.push({ start: parseFloat(n.getAttribute('start')) || 0, text: t }); });
  }
  if (!segs.length) throw A.err('yt_blocked');
  // merge short caption lines into sentences of ~10 seconds
  var out = [], cur = null;
  segs.forEach(function (s) {
    if (!cur || s.start - cur.start > 10 || /[.!?؟]$/.test(cur.text)) { cur = { start: s.start, text: s.text }; out.push(cur); }
    else cur.text += ' ' + s.text;
  });
  return out.slice(0, 400);
}
A.EXTRA_ERR.yt_blocked = 'يوتيوب ما سمح بقراءة نصوص هذا الفيديو. جرّب فيديو ثاني أو بعد شوي.';
A.EXTRA_ERR.yt_nocaps = 'هذا الفيديو ما فيه ترجمة نصية (Captions) أقدر أقراها.';
A.EXTRA_ERR.bad_media = 'ما قدرت أقرأ هذا الملف.';
A.EXTRA_ERR.no_audio = 'الملف ما فيه صوت.';
function youtubeScreen(prefill) {
  var sc = A.openScreen({ title: 'ترجمة فيديو يوتيوب' });
  var st = { segs: [], tl: 'ar', sl: 'en' };
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="yt-share" aria-label="مشاركة">' + icon('share') + '</button>';
  sc.body.innerHTML = '<form class="url-form" id="ytForm"><input id="ytIn" type="url" dir="ltr" placeholder="رابط يوتيوب" autocapitalize="off" autocorrect="off" value="' + esc(prefill || '') + '"><button type="submit" class="pbtn">ترجم</button></form>' +
    '<div id="ytBody"><div class="empty">الصق رابط فيديو يوتيوب فيه ترجمة نصية (CC)، ويطلع لك كلامه مكتوب ومترجم مع الوقت.</div></div>';
  var body = $('#ytBody', sc.body);
  $('#ytForm', sc.body).addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = ytId($('#ytIn', sc.body).value.trim());
    if (!id) { A.toast('الرابط مو رابط يوتيوب'); return; }
    body.innerHTML = '<div class="empty">جاري قراءة الفيديو…</div>';
    try {
      var info = await ytCaptions(id);
      var tr = info.tracks.filter(function (t) { return !t.auto; })[0] || info.tracks[0];
      st.sl = (tr.lang || 'en').split('-')[0];
      st.tl = A.targetFor(st.sl);
      body.innerHTML = '<h3 class="rd-title" dir="auto">' + esc(info.title) + '</h3><div class="rd-prog">جاري تحميل النص…</div><div class="ct-list" id="ytList"></div>';
      var segs = await ytTrack(tr.url);
      st.segs = segs;
      var listEl = $('#ytList', body);
      listEl.innerHTML = segs.map(function (g, i) {
        return '<div class="ct-seg" data-i="' + i + '"><div class="ct-time">' + fmtDur(g.start) + '</div><p class="ct-src" dir="auto">' + esc(g.text) + '</p><p class="ct-tr ' + A.styleClass(st.tl) + '" dir="auto"></p></div>';
      }).join('');
      var prog = $('.rd-prog', body);
      var out = await A.translateMany(segs.map(function (g) { return g.text; }), st.sl, st.tl, function (d, n) { prog.textContent = 'جاري الترجمة… ' + Math.round(100 * d / n) + '٪'; });
      out.forEach(function (t, i) { segs[i].tr = t; var el = $('.ct-seg[data-i="' + i + '"] .ct-tr', listEl); if (el) el.textContent = t; });
      prog.textContent = 'النص من ' + (tr.auto ? 'الترجمة التلقائية' : 'ترجمة') + ' (' + tr.name + ')، مترجم إلى ' + LANG[st.tl].ar + '. اضغط أي مقطع تسمعه.';
      listEl.onclick = function (ev) { var s = ev.target.closest('.ct-seg'); if (!s) return; var g = segs[+s.getAttribute('data-i')]; if (g && g.tr) A.speak(g.tr, st.tl); };
    } catch (er) { body.innerHTML = '<div class="err-box">' + esc(A.errMsg(er)) + '</div>'; }
  });
  A.ACTIONS['yt-share'] = function () {
    if (!st.segs.length) return;
    Native.call('share', { file: { name: 'ترجمان-يوتيوب.txt', text: st.segs.map(function (g) { return '[' + fmtDur(g.start) + '] ' + g.text + '\n' + (g.tr || ''); }).join('\n\n') } }).catch(function () {});
  };
  if (prefill) setTimeout(function () { $('#ytForm', sc.body).dispatchEvent(new Event('submit', { cancelable: true })); }, 60);
}

/* =========================================================
   16. Conversations in the history tab
   ========================================================= */
A.hookAdd('historyFilter', function (f, ul) {
  if (f !== 'convo') return false;
  if (!CONVOS.length) { ul.innerHTML = '<li style="display:block;border:0"><div class="empty"><div class="big">ما فيه محادثات محفوظة</div>محادثات وضع «محادثة» و«استماع مستمر» تنحفظ هنا.</div></li>'; return true; }
  ul.innerHTML = CONVOS.map(function (c) {
    var first = c.turns[0] || {};
    return '<li data-cid="' + c.id + '"><button type="button" class="h-main" data-act="cv-open" data-cid="' + c.id + '">' +
      '<div class="h-src">' + (c.kind === 'lecture' ? 'استماع مستمر' : 'محادثة') + ': ' + esc(LANG[c.a] ? LANG[c.a].ar : c.a) + ' ⇄ ' + esc(LANG[c.b] ? LANG[c.b].ar : c.b) + '</div>' +
      '<div class="h-tr" dir="auto">' + esc(first.text || '') + '</div><div class="h-meta">' + esc(A.fmtTime(c.ts)) + '، ' + c.turns.length + ' ' + (c.kind === 'lecture' ? 'مقطع' : 'جملة') + '</div></button>' +
      '<button type="button" class="ic" data-act="cv-del" data-cid="' + c.id + '" aria-label="حذف">' + icon('trash') + '</button></li>';
  }).join('');
  return true;
});
A.ACTIONS['cv-del'] = function (b) { CONVOS = CONVOS.filter(function (c) { return c.id !== b.getAttribute('data-cid'); }); saveConvos(); A.renderHistory(); };
A.ACTIONS['cv-open'] = function (b) {
  var c = CONVOS.filter(function (x) { return x.id === b.getAttribute('data-cid'); })[0]; if (!c) return;
  var sc = A.openScreen({ title: (c.kind === 'lecture' ? 'استماع مستمر' : 'محادثة') + ' — ' + A.fmtTime(c.ts) });
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="cvo-share" aria-label="مشاركة">' + icon('share') + '</button>';
  sc.body.innerHTML = '<div class="bubbles">' + c.turns.map(function (t, i) {
    return '<div class="bub bub-' + t.side + '" data-i="' + i + '"><p class="b-src" dir="auto">' + esc(t.text) + '</p><p class="b-tr ' + A.styleClass(t.tl) + '" dir="auto">' + esc(t.tr) + '</p></div>';
  }).join('') + '</div>';
  sc.body.onclick = function (e) { var x = e.target.closest('.bub'); if (!x) return; var t = c.turns[+x.getAttribute('data-i')]; if (t && t.tr) A.speak(t.tr, t.tl); };
  A.ACTIONS['cvo-share'] = function () { Native.call('share', { file: { name: 'ترجمان-محادثة.txt', text: c.turns.map(function (t) { return t.text + '\n' + t.tr; }).join('\n\n') } }).catch(function () {}); };
};

/* =========================================================
   15. AirPods / headphones
   ========================================================= */
function showRoute() {
  Native.call('audioRoute', {}).then(function (r) {
    if (r && r.bt) { dockNote('🎧 الترجمة تطلع في ' + esc(r.name || 'السماعة')); setTimeout(function () { if (!autoSt.on) dockNote(''); }, 3500); }
  }).catch(function () {});
}
Native.on('appActive', showRoute);
setTimeout(showRoute, 1200);
A.hookAdd('settingsGroups', function () {
  return '<div class="group"><h2>السماعات (AirPods)</h2><div class="panel">' +
    '<div class="row"><div class="r-main"><div class="r-title">استخدم مايك السماعة</div><div class="r-sub">لما تكون لابس AirPods: إذا تشغّله تتكلم في مايك السماعة، وإذا تطفيه يستخدم مايك الجوال وأنت تسمع الترجمة في السماعة.</div></div>' +
    '<button type="button" class="switch' + (S.btMic ? ' is-on' : '') + '" data-act="toggle" data-k="btMic" role="switch" aria-checked="' + !!S.btMic + '"></button></div>' +
    '</div></div>';
});

/* tools */
A.addTool({ id: 'convo', label: 'محادثة', icon: 'chat', order: 10, run: convoScreen });
A.addTool({ id: 'cont', label: 'استماع مستمر', icon: 'listen', order: 12, run: continuousScreen });
A.addTool({ id: 'afile', label: 'ملف صوتي', icon: 'audio', order: 40, run: fileScreen });
A.addTool({ id: 'yt', label: 'يوتيوب', icon: 'video', order: 62, run: function () { youtubeScreen(); } });

A.convoScreen = convoScreen; A.continuousScreen = continuousScreen; A.youtubeScreen = youtubeScreen; A.fileScreen = fileScreen;
A.langOptions = langOptions; A.fmtDur = fmtDur; A.dockNote = dockNote;
})();
