'use strict';
/* Camera & files: live camera translate (19), photo (20), screenshot (21), PDF/Word/text documents (22),
   menu explanation (24), handwriting (25), share translation as an image (58). */
(function () {
var A = window.App, $ = A.$, $$ = A.$$, esc = A.esc, icon = A.icon, S = A.S, Native = A.Native, LANG = A.LANG;

A.EXTRA_ERR.camera_denied = 'اسمح لترجمان باستخدام الكاميرا من: الإعدادات ← ترجمان.';
A.EXTRA_ERR.bad_document = 'ما قدرت أفتح هذا الملف.';
A.EXTRA_ERR.pdf_failed = 'تعذر إنشاء ملف PDF.';

function scriptLang(text) {
  var sc = A.scriptOf(text || '');
  return sc === 'arabic' ? 'ar' : sc === 'deva' ? 'hi' : 'en';
}
function targetForText(text) {
  var l = scriptLang(text);
  if (l === 'ar') return A.otherOf(A.S.pairA === 'ar' || A.S.pairB === 'ar' ? 'ar' : A.S.pairA) || 'en';
  return (A.S.pairA === 'ar' || A.S.pairB === 'ar') ? 'ar' : A.otherOf(A.S.pairA);
}

/* =========================================================
   Photo / camera result screen
   ========================================================= */
function photoScreen(res, title) {
  var blocks = (res.blocks || []).filter(function (b) { return b.text && b.text.trim(); });
  var all = blocks.map(function (b) { return b.text; }).join('\n');
  var tl = targetForText(all);
  var sc = A.openScreen({ title: title || 'ترجمة الصورة' });
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="ph-copy" aria-label="نسخ">' + icon('copy') + '</button>' +
    '<button type="button" class="ic" data-act="ph-share" aria-label="مشاركة">' + icon('share') + '</button>';
  var note = '';
  if (!blocks.length) note = '<div class="notice">ما لقيت كلام واضح في الصورة. قرّب الكاميرا وخل الإضاءة زينة.' + (res.arabicOCR === false ? ' (قراءة الحروف العربية من الصور تحتاج iOS أحدث.)' : '') + '</div>';
  sc.body.innerHTML = note +
    '<div class="ph-wrap" id="phWrap"><img id="phImg" src="' + res.image + '" alt=""><div class="ph-boxes" id="phBoxes"></div></div>' +
    (blocks.length ? '<div class="seg seg3 rd-mode" id="phMode"><button type="button" class="is-on" data-m="tr">فوق الصورة</button><button type="button" data-m="src">الأصل</button><button type="button" data-m="list">نص فقط</button></div>' +
      '<div class="ph-acts"><button type="button" class="pbtn" data-act="ph-menu">' + icon('bulb') + '<span>اشرح المنيو</span></button>' +
      '<button type="button" class="pbtn" data-act="ph-send">' + icon('translate') + '<span>افتحه في المترجم</span></button>' +
      '<button type="button" class="pbtn" data-act="ph-speak">' + icon('speaker') + '<span>استمع</span></button></div>' +
      '<div id="phExtra"></div><div class="ct-list" id="phList"></div>' : '');
  if (!blocks.length) return;
  var listEl = $('#phList', sc.body), boxes = $('#phBoxes', sc.body), wrap = $('#phWrap', sc.body);
  listEl.innerHTML = blocks.map(function (b, i) {
    return '<div class="ct-seg" data-i="' + i + '"><p class="ct-src" dir="auto">' + esc(b.text) + '</p><p class="ct-tr ' + A.styleClass(tl) + '" dir="auto">…</p></div>';
  }).join('');
  boxes.innerHTML = blocks.map(function (b, i) {
    var px = Math.min(0.012, b.x), py = Math.min(b.h * 0.12, b.y);
    b = { x: b.x - px, y: b.y - py, w: Math.min(1 - b.x + px, b.w + px * 2), h: Math.min(1 - b.y + py, b.h + py * 2), text: b.text };
    blocks[i] = Object.assign({}, blocks[i], { w: b.w, h: b.h });
    return '<div class="ph-box" data-i="' + i + '" style="left:' + (b.x * 100) + '%;top:' + (b.y * 100) + '%;width:' + (b.w * 100) + '%;min-height:' + (b.h * 100) + '%"><span dir="auto"></span></div>';
  }).join('');
  var tr = [];
  var meas = document.createElement('canvas').getContext('2d');
  function fitBoxes() {
    var img = $('#phImg', sc.body), imgW = img.clientWidth, imgH = img.clientHeight;
    if (!imgW) return;
    $$('.ph-box', boxes).forEach(function (el) {
      var b = blocks[+el.getAttribute('data-i')], sp = $('span', el), t = sp.textContent || '';
      var bw = b.w * imgW, bh = b.h * imgH;
      var fs = Math.max(9, Math.min(28, bh * 0.72));
      if (t) {
        meas.font = '600 ' + fs + 'px -apple-system, sans-serif';
        var tw = meas.measureText(t).width + 6;
        if (tw > bw) fs = Math.max(9, fs * bw / tw);
        meas.font = '600 ' + fs + 'px -apple-system, sans-serif';
        var wrap = meas.measureText(t).width + 6 > bw;
        el.classList.toggle('wrap', wrap);
      }
      el.style.fontSize = fs + 'px';
    });
  }
  $('#phImg', sc.body).addEventListener('load', fitBoxes);
  window.addEventListener('resize', fitBoxes);
  A.translateMany(blocks.map(function (b) { return b.text; }), 'auto', tl).then(function (out) {
    tr = out;
    out.forEach(function (t, i) {
      var li = $('.ct-seg[data-i="' + i + '"] .ct-tr', listEl); if (li) li.textContent = t;
      var bx = $('.ph-box[data-i="' + i + '"] span', boxes); if (bx) bx.textContent = t;
    });
    fitBoxes();
  }).catch(function (e) { A.toast(A.errMsg(e)); });
  $('#phMode', sc.body).addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    $$('#phMode button', sc.body).forEach(function (x) { x.classList.toggle('is-on', x === b); });
    var m = b.getAttribute('data-m');
    wrap.hidden = m === 'list';
    boxes.hidden = m === 'src';
  });
  listEl.onclick = function (e) { var s = e.target.closest('.ct-seg'); if (!s) return; var t = tr[+s.getAttribute('data-i')]; if (t) A.speak(t, tl); };
  function textOut() { return blocks.map(function (b, i) { return b.text + '\n' + (tr[i] || ''); }).join('\n\n'); }
  A.ACTIONS['ph-copy'] = function () { Native.call('copy', { text: textOut() }).catch(function () {}); A.toast('نُسخ'); };
  A.ACTIONS['ph-share'] = function () { Native.call('share', { text: textOut() }).catch(function () {}); };
  A.ACTIONS['ph-speak'] = function () { if (tr.length) A.speak(tr.join('. '), tl); };
  A.ACTIONS['ph-send'] = function () {
    A.closeScreen(sc); A.showView('translate');
    A.srcEl.value = all; A.T.sessionId = null; A.onInput();
  };
  A.ACTIONS['ph-menu'] = function () { explainMenu(all, $('#phExtra', sc.body)); };
}

/* 24. Menu explanation */
function explainMenu(text, box) {
  if (!A.engineReady('claude')) {
    box.innerHTML = '<div class="notice">شرح الأطباق ومكوناتها يحتاج مفتاح Claude. الترجمة تحت تشتغل بدونه. <button type="button" data-act="goto-claude">إضافة المفتاح</button></div>';
    return;
  }
  box.innerHTML = '<div class="empty">جاري شرح المنيو…</div>';
  var sys = 'The user text is OCR text from a restaurant menu. For each dish or drink, write one line in Arabic: the dish name (original), a natural Arabic name, ' +
    'and a very short explanation of what it is and its main ingredients. Mark anything that usually contains pork with 🐖 and alcohol with 🍷. ' +
    'Skip prices, headings and non-food lines. Use "• " at the start of each line. No other text.';
  A.claudeCall(sys, text.slice(0, 6000), 1800).then(function (out) {
    box.innerHTML = '<div class="block-h"><span>شرح المنيو</span></div><div class="extra-card"><div class="explain" dir="rtl">' + esc(out).replace(/\n/g, '<br>') + '</div></div>';
  }).catch(function (e) { box.innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; });
}
A.ACTIONS['goto-claude'] = function () { A.closeScreen(); A.gotoKey('claudeKey'); };

function runCamera() {
  Native.call('camera', { tl: S.pairA === 'ar' || S.pairB === 'ar' ? 'ar' : A.T.tgt }).then(function (r) {
    if (!r || r.cancelled) return;
    photoScreen(r, 'ترجمة بالكاميرا');
  }).catch(function (e) { A.toast(A.errMsg(e)); });
}
function runPhoto(screens) {
  Native.call('pickPhoto', { screenshots: !!screens }).then(function (r) {
    if (!r || r.cancelled) return;
    photoScreen(r, screens ? 'ترجمة سكرين شوت' : 'ترجمة صورة');
  }).catch(function (e) { A.toast(A.errMsg(e)); });
}
/* 21. Screenshots: pick from the Screenshots album, or a copied screenshot */
function runClipImage() {
  Native.call('ocrClipboard', {}).then(function (r) {
    if (!r || r.cancelled) { A.toast('ما فيه صورة منسوخة'); return; }
    photoScreen(r, 'ترجمة الصورة المنسوخة');
  }).catch(function (e) { A.toast(A.errMsg(e)); });
}
A.ACTIONS['clip-img'] = function (b) { A.Store.set('clipSeen', b.getAttribute('data-c')); $('#clipBanner').hidden = true; runClipImage(); };

/* =========================================================
   22. Documents: PDF, Word (.docx), text
   ========================================================= */
function paragraphsFromText(t) {
  var lines = String(t || '').replace(/\r/g, '').split('\n');
  var maxLen = lines.reduce(function (m, l) { return Math.max(m, l.trim().length); }, 0);
  var out = [], cur = '';
  lines.forEach(function (l) {
    var s = l.trim();
    if (!s) { if (cur) { out.push(cur); cur = ''; } return; }
    cur = cur ? cur + ' ' + s : s;
    // a line clearly shorter than the page's full lines ends its paragraph (or is a heading)
    if (/[.!?؟:]$/.test(s) && s.length < maxLen * 0.85 || s.length < maxLen * 0.6) { out.push(cur); cur = ''; }
  });
  if (cur) out.push(cur);
  return out.filter(function (p) { return p.length > 1; });
}
function docHTML(title, paras, tl) {
  var rtl = A.isRtl(tl);
  return '<!doctype html><html lang="' + tl + '" dir="' + (rtl ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><style>' +
    'body{font-family:-apple-system,"Geeza Pro","Helvetica Neue",sans-serif;font-size:12.5pt;line-height:1.75;color:#111;margin:0}' +
    'h1{font-size:17pt;margin:0 0 14pt;border-bottom:1px solid #ccc;padding-bottom:6pt}p{margin:0 0 9pt}.pg{font-size:9pt;color:#888;margin:14pt 0 6pt}' +
    '</style></head><body><h1>' + esc(title) + '</h1>' + paras.map(function (p) { return p.page ? '<div class="pg">' + esc(p.page) + '</div>' : '<p>' + esc(p.t) + '</p>'; }).join('') + '</body></html>';
}
function docScreen() {
  var sc = A.openScreen({ title: 'ترجمة ملف' });
  var st = { paras: [], tr: [], tl: 'ar', name: '', kind: '', docx: null };
  sc.actions.innerHTML = '<button type="button" class="ic" data-act="dc-share" aria-label="تصدير">' + icon('share') + '</button>';
  sc.body.innerHTML = '<div class="tf-pick"><button type="button" class="big-btn" data-act="dc-pick">' + icon('file') + '<span>اختر ملف PDF أو Word أو نص</span></button></div>' +
    '<p class="scr-hint">ملفات Word ترجع لك ملف Word مترجم بنفس التنسيق (العناوين والجداول والخطوط). ملفات PDF تترجم صفحة صفحة وتقدر تصدّرها PDF مترجم، وإذا كانت مصوّرة يقرأ الكلام من الصور.</p>' +
    '<div class="tf-prog" id="dcProg" hidden><div class="bt-bar"><i></i></div><span></span></div>' +
    '<div class="seg seg3 rd-mode" id="dcMode" hidden><button type="button" class="is-on" data-m="tr">الترجمة</button><button type="button" data-m="both">الاثنين</button><button type="button" data-m="src">الأصل</button></div>' +
    '<div id="dcBody" data-mode="tr"></div>';
  var prog = $('#dcProg', sc.body), body = $('#dcBody', sc.body);
  function setProg(p, txt) { prog.hidden = false; $('i', prog).style.width = Math.round(p * 100) + '%'; $('span', prog).textContent = txt; }
  var offP = Native.on('docProgress', function (d) { setProg(d.done / d.total * 0.5, 'جاري قراءة الصفحات المصوّرة… ' + d.done + ' من ' + d.total); });
  var oc = sc.o.onClose; sc.o.onClose = function () { offP(); if (oc) oc(); };
  $('#dcMode', sc.body).addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    $$('#dcMode button', sc.body).forEach(function (x) { x.classList.toggle('is-on', x === b); });
    body.setAttribute('data-mode', b.getAttribute('data-m'));
  });
  A.ACTIONS['dc-pick'] = async function () {
    try {
      var r = await Native.call('pickDocument', {});
      if (!r || r.cancelled) return;
      st.name = (r.name || 'document').replace(/\.[^.]+$/, ''); st.kind = r.kind;
      setProg(0.05, 'جاري قراءة الملف…');
      var paras = [];
      if (r.kind === 'pdf') {
        (r.pages || []).forEach(function (pg, i) { var ps = paragraphsFromText(pg); if (ps.length) { paras.push({ page: 'صفحة ' + (i + 1) }); ps.forEach(function (t) { paras.push({ t: t }); }); } });
        if (r.total > (r.pages || []).length) A.toast('ترجمت أول ' + r.pages.length + ' صفحة من ' + r.total);
      } else if (r.kind === 'docx') {
        st.docx = parseDocx(r.b64);
        st.docx.paras.forEach(function (p) { paras.push({ t: p.text }); });
      } else {
        paragraphsFromText(r.text).forEach(function (t) { paras.push({ t: t }); });
      }
      var texts = paras.filter(function (p) { return p.t; });
      if (!texts.length) { setProg(1, 'ما لقيت نص في الملف'); return; }
      var sample = texts.slice(0, 6).map(function (p) { return p.t; }).join(' ');
      var sl = await A.detectLang(sample) || scriptLang(sample);
      st.tl = A.targetFor(sl);
      st.paras = paras;
      $('#dcMode', sc.body).hidden = false;
      body.innerHTML = paras.map(function (p, i) {
        if (p.page) return '<div class="dc-page">' + esc(p.page) + '</div>';
        return '<div class="rd-b" data-i="' + i + '"><p class="rd-src" dir="auto">' + esc(p.t) + '</p><p class="rd-tr ' + A.styleClass(st.tl) + '" dir="' + (A.isRtl(st.tl) ? 'rtl' : 'ltr') + '"></p></div>';
      }).join('');
      var idx = [], list = [];
      paras.forEach(function (p, i) { if (p.t) { idx.push(i); list.push(p.t); } });
      var out = await A.translateMany(list, sl || 'auto', st.tl, function (d, n) { setProg(0.5 + 0.5 * d / n, 'جاري الترجمة… ' + Math.round(100 * d / n) + '٪'); });
      st.tr = [];
      out.forEach(function (t, k) { var i = idx[k]; st.tr[i] = t; var el = $('.rd-b[data-i="' + i + '"] .rd-tr', body); if (el) el.textContent = t; });
      setProg(1, 'خلصت الترجمة إلى ' + LANG[st.tl].ar + '. صدّرها من زر المشاركة فوق.');
    } catch (e) { setProg(1, A.errMsg(e)); }
  };
  A.ACTIONS['dc-share'] = function () {
    if (!st.tr.length) { A.toast('اختر ملف وترجمه أول'); return; }
    var opts = '<button type="button" class="chip" data-act="dc-exp" data-f="pdf">PDF مترجم</button><button type="button" class="chip" data-act="dc-exp" data-f="txt">ملف نص</button>';
    if (st.kind === 'docx') opts = '<button type="button" class="chip" data-act="dc-exp" data-f="docx">Word مترجم (نفس التنسيق)</button>' + opts;
    A.openModal('<h3>تصدير الترجمة</h3><div class="chips" style="padding:4px">' + opts + '</div>');
  };
  A.ACTIONS['dc-exp'] = function (b) {
    A.closeModal();
    var f = b.getAttribute('data-f'), name = st.name + ' - مترجم';
    if (f === 'docx') {
      try { var b64 = buildDocx(st.docx, st.tr, st.tl); Native.call('share', { file: { name: name + '.docx', b64: b64 } }).catch(function () {}); }
      catch (e) { A.toast('تعذر إنشاء ملف Word'); }
    } else if (f === 'pdf') {
      var paras = st.paras.map(function (p, i) { return p.page ? p : { t: st.tr[i] || '' }; });
      Native.call('makePDF', { html: docHTML(st.name, paras, st.tl), name: name + '.pdf' }).catch(function (e) { A.toast(A.errMsg(e)); });
    } else {
      Native.call('share', { file: { name: name + '.txt', text: st.paras.map(function (p, i) { return p.page ? '— ' + p.page + ' —' : (st.tr[i] || ''); }).join('\n\n') } }).catch(function () {});
    }
  };
}

/* ---- .docx: keep formatting, replace the text of each paragraph ---- */
var W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function b64ToBytes(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function bytesToB64(u) { var s = '', CH = 0x8000; for (var i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return btoa(s); }
function parseDocx(b64) {
  var files = fflate.unzipSync(b64ToBytes(b64));
  var xml = fflate.strFromU8(files['word/document.xml']);
  var doc = new DOMParser().parseFromString(xml, 'application/xml');
  var paras = [];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(W, 'p'), function (p) {
    var ts = p.getElementsByTagNameNS(W, 't');
    var text = Array.prototype.map.call(ts, function (t) { return t.textContent; }).join('');
    if (text.trim()) paras.push({ node: p, text: text });
  });
  return { files: files, doc: doc, paras: paras };
}
/* WordprocessingML requires a fixed child order inside pPr / rPr */
var PPR_AFTER_BIDI = ['adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
var RPR_AFTER_RTL = ['cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath', 'rPrChange'];
function childNS(el, name) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.namespaceURI === W && c.localName === name) return c; return null; }
function insertOrdered(parent, node, before) {
  for (var c = parent.firstElementChild; c; c = c.nextElementSibling) if (before.indexOf(c.localName) >= 0) { parent.insertBefore(node, c); return; }
  parent.appendChild(node);
}
function buildDocx(dx, tr, tl) {
  var rtl = A.isRtl(tl);
  dx.paras.forEach(function (p, i) {
    var t = tr[i]; if (!t) return;
    var ts = p.node.getElementsByTagNameNS(W, 't');
    if (!ts.length) return;
    ts[0].textContent = t;
    ts[0].setAttribute('xml:space', 'preserve');
    for (var k = 1; k < ts.length; k++) ts[k].textContent = '';
    if (rtl) {
      var pPr = childNS(p.node, 'pPr');
      if (!pPr) { pPr = dx.doc.createElementNS(W, 'w:pPr'); p.node.insertBefore(pPr, p.node.firstChild); }
      if (!childNS(pPr, 'bidi')) insertOrdered(pPr, dx.doc.createElementNS(W, 'w:bidi'), PPR_AFTER_BIDI);
      Array.prototype.forEach.call(p.node.getElementsByTagNameNS(W, 'r'), function (r) {
        if (r.parentNode && r.parentNode.localName === 'rPr') return;
        var rPr = childNS(r, 'rPr');
        if (!rPr) { rPr = dx.doc.createElementNS(W, 'w:rPr'); r.insertBefore(rPr, r.firstChild); }
        if (!childNS(rPr, 'rtl')) insertOrdered(rPr, dx.doc.createElementNS(W, 'w:rtl'), RPR_AFTER_RTL);
      });
    }
  });
  var out = Object.assign({}, dx.files);
  out['word/document.xml'] = fflate.strToU8(new XMLSerializer().serializeToString(dx.doc));
  return bytesToB64(fflate.zipSync(out, { level: 6 }));
}

/* =========================================================
   25. Handwriting
   ========================================================= */
function handScreen() {
  var sc = A.openScreen({ title: 'كتابة باليد' });
  sc.body.innerHTML = '<p class="scr-hint">اكتب بإصبعك كلمة أو جملة (الإنجليزي أوضح)، واضغط «اقرأ الكتابة».</p>' +
    '<div class="hw-pad"><canvas id="hwCanvas"></canvas></div>' +
    '<div class="ph-acts"><button type="button" class="pbtn" data-act="hw-read">' + icon('check') + '<span>اقرأ الكتابة</span></button>' +
    '<button type="button" class="pbtn" data-act="hw-undo">' + icon('repeat') + '<span>تراجع</span></button>' +
    '<button type="button" class="pbtn" data-act="hw-clear">' + icon('trash') + '<span>مسح</span></button></div>' +
    '<div id="hwOut"></div>';
  var cv = $('#hwCanvas', sc.body), ctx = cv.getContext('2d'), strokes = [], curS = null;
  function size() {
    var r = cv.parentNode.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); redraw();
  }
  function redraw() {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    strokes.forEach(function (s) { ctx.beginPath(); s.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); });
  }
  function pt(e) { var r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); curS = [pt(e)]; strokes.push(curS); redraw(); });
  cv.addEventListener('pointermove', function (e) { if (!curS) return; e.preventDefault(); curS.push(pt(e)); redraw(); });
  cv.addEventListener('pointerup', function () { curS = null; });
  setTimeout(size, 50);
  A.ACTIONS['hw-clear'] = function () { strokes = []; redraw(); $('#hwOut', sc.body).innerHTML = ''; };
  A.ACTIONS['hw-undo'] = function () { strokes.pop(); redraw(); };
  A.ACTIONS['hw-read'] = function () {
    if (!strokes.length) return;
    var out = $('#hwOut', sc.body);
    out.innerHTML = '<div class="empty">جاري القراءة…</div>';
    Native.call('ocr', { image: cv.toDataURL('image/png'), preferArabic: false }).then(function (r) {
      var text = (r.blocks || []).sort(function (a, b) { return a.y - b.y; }).map(function (b) { return b.text; }).join(' ').trim();
      if (!text) { out.innerHTML = '<div class="notice">ما قدرت أقرأ الكتابة. اكتب أكبر وأوضح.</div>'; return; }
      var tl = targetForText(text);
      out.innerHTML = '<div class="field"><div class="f-label"><span>قريتها كذا (تقدر تعدلها)</span></div><input id="hwText" type="text" dir="auto" value="' + esc(text) + '"></div>' +
        '<div class="ph-acts"><button type="button" class="pbtn" data-act="hw-tr">' + icon('translate') + '<span>ترجم</span></button></div><div id="hwTr"></div>';
      A.ACTIONS['hw-tr'] = function () {
        var t = $('#hwText', sc.body).value.trim(); if (!t) return;
        A.closeScreen(sc); A.showView('translate'); A.srcEl.value = t; A.T.sessionId = null; A.onInput();
      };
      A.ACTIONS['hw-tr']();
    }).catch(function (e) { out.innerHTML = '<div class="err-box">' + esc(A.errMsg(e)) + '</div>'; });
  };
}

/* =========================================================
   58. Share translation as an image
   ========================================================= */
function wrapLines(ctx, text, maxW) {
  var words = String(text).split(/\s+/), lines = [], cur = '';
  words.forEach(function (w) {
    var t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  });
  if (cur) lines.push(cur);
  return lines;
}
async function shareImage(r) {
  try { await document.fonts.load('48px Amiri'); await document.fonts.load('bold 48px Amiri'); } catch (e) {}
  var W2 = 1080, pad = 84, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  var dark = false;
  var srcFont = (A.isRtl(r.sl) ? '40px Amiri' : '38px Georgia, serif');
  var trFont = (A.isRtl(r.tl) ? 'bold 64px Amiri' : 'bold 58px Georgia, serif');
  ctx.font = srcFont; var srcLines = wrapLines(ctx, r.source, W2 - pad * 2).slice(0, 8);
  ctx.font = trFont; var trLines = wrapLines(ctx, r.text, W2 - pad * 2).slice(0, 10);
  var H = pad + 90 + srcLines.length * 56 + 60 + trLines.length * 92 + 140;
  cv.width = W2; cv.height = Math.max(H, 540);
  ctx.fillStyle = dark ? '#0C0F1E' : '#F3F5FA'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#1F3A8F'; ctx.fillRect(0, 0, cv.width, 14);
  var y = pad + 30;
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = '#7E85A3'; ctx.font = '30px -apple-system, sans-serif';
  ctx.fillText(LANG[r.sl].ar + '  ←  ' + LANG[r.tl].ar, W2 - pad, y); y += 70;
  function para(lines, font, color, lh, lang) {
    ctx.font = font; ctx.fillStyle = color;
    var rtl = A.isRtl(lang); ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = rtl ? 'right' : 'left';
    lines.forEach(function (l) { ctx.fillText(l, rtl ? W2 - pad : pad, y); y += lh; });
  }
  para(srcLines, srcFont, '#4A5172', 56, r.sl); y += 30;
  ctx.fillStyle = '#E1E5F0'; ctx.fillRect(pad, y - 20, W2 - pad * 2, 2); y += 50;
  para(trLines, trFont, '#141933', 92, r.tl);
  ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.font = 'bold 40px Amiri'; ctx.fillStyle = '#8E6510';
  ctx.fillText('ترجمان', W2 - pad, cv.height - 60);
  Native.call('share', { image: cv.toDataURL('image/png') }).catch(function (e) { A.toast(A.errMsg(e)); });
}
A.addResultAction({ id: 'img', label: 'شارك كصورة', sub: 'بطاقة مرتبة فيها النص وترجمته', icon: 'image', order: 20, run: shareImage });

/* tools */
A.addTool({ id: 'cam', label: 'كاميرا', icon: 'camera', order: 20, run: runCamera });
A.addTool({ id: 'photo', label: 'صورة', icon: 'image', order: 22, run: function () { runPhoto(false); } });
A.addTool({ id: 'shot', label: 'سكرين شوت', icon: 'phone', order: 24, run: function () { runPhoto(true); } });
A.addTool({ id: 'doc', label: 'ملف', icon: 'file', order: 30, run: docScreen });
A.addTool({ id: 'hand', label: 'كتابة باليد', icon: 'pen', order: 70, run: handScreen });

A.photoScreen = photoScreen; A.runCamera = runCamera; A.runPhoto = runPhoto; A.runClipImage = runClipImage; A.docScreen = docScreen; A.shareImage = shareImage;
})();
