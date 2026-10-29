'use strict';
/* 56. Shortcuts: turjuman:// links (Siri Shortcuts, Action button, Back Tap), Home-screen quick actions, notification taps.
   Loaded last so every feature module has registered its screens. */
(function () {
var A = window.App, $ = A.$, S = A.S, Native = A.Native, LANG = A.LANG;

function parseQuery(q) {
  var o = {};
  String(q || '').split('&').forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
    try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { o[k] = v; }
  });
  return o;
}
function parseLink(u) {
  var m = String(u || '').match(/^turjuman:\/*([^?\/#]*)\/?([^?#]*)(?:\?([^#]*))?/i);
  if (!m) return null;
  var p = parseQuery(m[3]);
  if (m[2] && !p.text && !p.q) p.path = decodeURIComponent(m[2]);
  return { route: (m[1] || 'translate').toLowerCase(), params: p };
}
function langCode(x) {
  if (!x) return null;
  x = String(x).toLowerCase();
  if (LANG[x]) return x;
  var hit = A.LANG_ORDER.filter(function (l) { return LANG[l].name.toLowerCase() === x || LANG[l].ar === x; })[0];
  return hit || null;
}

function closeAll() { Array.prototype.forEach.call(document.querySelectorAll('#screens .screen.in'), function () { A.closeScreen(); }); A.closeModal(); }
function translateText(text, from, to) {
  A.showView('translate');
  var src = langCode(from) || (text && A.detect(text)) || A.T.src;
  var tgt = langCode(to);
  if (tgt && tgt !== src) {
    var inPair = (src === S.pairA && tgt === S.pairB) || (src === S.pairB && tgt === S.pairA);
    if (inPair) A.setDir(src); else A.setPair(src, tgt, src);
  } else if (src === S.pairA || src === S.pairB) A.setDir(src);
  A.srcEl.value = text || '';
  A.T.sessionId = null;
  A.onInput();
  if (!text) setTimeout(function () { A.srcEl.focus(); }, 250);
}
function translateClipboard() {
  Native.call('clipboardInfo', {}).then(function (r) {
    if (r && r.image && A.runClipImage) { A.runClipImage(); return; }
    return Native.call('paste', {}).then(function (p) {
      if (!p || !p.text) { A.toast('الحافظة فاضية'); return; }
      Store_seen(r);
      translateText(p.text);
    });
  }).catch(function () {});
}
function Store_seen(r) { if (r && r.count != null) A.Store.set('clipSeen', String(r.count)); var b = $('#clipBanner'); if (b) b.hidden = true; }

var ROUTES = {
  translate: function (p) { translateText(p.text || p.path || '', p.from, p.to); },
  t: function (p) { ROUTES.translate(p); },
  speak: function (p) {
    if (p.text) { translateText(p.text, p.from, p.to); A.T.speakWhenDone = true; return; }
    A.showView('translate');
    var side = p.lang && langCode(p.lang) === S.pairB ? 'b' : 'a';
    setTimeout(function () { var b = $('.mic[data-side="' + side + '"]'); if (b) b.click(); }, 350);
  },
  auto: function () { A.showView('translate'); setTimeout(function () { var b = $('#micAuto'); if (b) b.click(); }, 350); },
  clipboard: translateClipboard,
  paste: translateClipboard,
  dict: function (p) {
    A.showView('dict');
    var q = p.q || p.word || p.text || p.path;
    if (q) { $('#dictInput').value = q; A.dictSearch(q); }
    else setTimeout(function () { $('#dictInput').focus(); }, 250);
  },
  convo: function () { A.convoScreen(); },
  conversation: function () { A.convoScreen(); },
  listen: function () { A.continuousScreen(); },
  camera: function () { A.runCamera(); },
  photo: function () { A.runPhoto(false); },
  screenshot: function () { A.runPhoto(true); },
  doc: function () { A.docScreen(); },
  file: function () { A.docScreen(); },
  audio: function () { A.fileScreen(); },
  youtube: function (p) { A.youtubeScreen(p.url || ''); },
  read: function (p) { A.readerScreen(p.url || ''); },
  web: function (p) { A.readerScreen(p.url || ''); },
  history: function () { A.showView('history'); },
  learn: function () { A.showView('learn'); },
  settings: function () { A.showView('settings'); }
};
Object.assign(ROUTES, A.MORE_ROUTES || {});
A.ROUTES = ROUTES;

function run(action) {
  if (!action) return;
  var route = action.type, params = action.params || {};
  if (route === 'url') {
    var l = parseLink(action.url);
    if (!l) return;
    route = l.route; params = l.params;
  }
  var fn = ROUTES[route];
  if (!fn) { A.toast('الرابط غير معروف: ' + route); return; }
  // let the UI settle first (cold launch)
  setTimeout(function () { try { closeAll(); fn(params); } catch (e) { console.error(e); } }, 120);
}
A.runAction = run;
Native.on('action', run);

/* Settings: how to use with Shortcuts / Action button */
var LINKS = [
  ['turjuman://clipboard', 'ترجم النص أو الصورة المنسوخة'],
  ['turjuman://translate?text=…&to=ar', 'ترجم نص (من اختصار فيه «اطلب إدخال» أو «النص المحدد»)'],
  ['turjuman://speak?lang=en', 'افتح الميكروفون مباشرة'],
  ['turjuman://auto', 'تكلّم بأي لغة والتطبيق يعرفها'],
  ['turjuman://convo', 'وضع المحادثة'],
  ['turjuman://camera', 'الكاميرا'],
  ['turjuman://screenshot', 'ترجم سكرين شوت'],
  ['turjuman://dict?q=word', 'ابحث في القاموس'],
  ['turjuman://listen', 'استماع مستمر']
];
A.hookAdd('settingsGroups', function () {
  return '<div class="group"><h2>اختصارات Siri وزر الإجراء</h2><div class="panel">' +
    '<div class="row choice" data-act="sc-help"><div class="r-main"><div class="r-title">طريقة الربط</div><div class="r-sub">شغّل أي ميزة من «الاختصارات» أو زر الإجراء أو النقر على ظهر الجوال.</div></div><span class="link-btn">عرض</span></div>' +
    '</div><p class="hint">اضغط مطولًا على أيقونة ترجمان في الشاشة الرئيسية تطلع لك اختصارات سريعة.</p></div>';
});
A.ACTIONS['sc-help'] = function () {
  A.openModal('<h3>ربط ترجمان بالاختصارات</h3>' +
    '<ol class="howto"><li>افتح تطبيق «الاختصارات» واضغط +.</li><li>أضف إجراء «فتح عناوين URL» (Open URLs).</li><li>حط واحد من الروابط تحت، واحفظ الاختصار باسم مثل «ترجم».</li>' +
    '<li>تقدر تشغّله بـ «يا Siri، ترجم»، أو تربطه بزر الإجراء (الإعدادات ← زر الإجراء ← اختصار)، أو بالنقر مرتين على ظهر الجوال (تسهيلات الاستخدام ← اللمس ← النقر على الظهر).</li></ol>' +
    '<div class="panel">' + LINKS.map(function (l) {
      return '<div class="row choice" data-act="sc-copy" data-v="' + A.esc(l[0]) + '"><div class="r-main"><div class="r-title sc-link" dir="ltr">' + A.esc(l[0]) + '</div><div class="r-sub">' + A.esc(l[1]) + '</div></div><span class="ra-ic">' + A.icon('copy') + '</span></div>';
    }).join('') + '</div>');
};
A.ACTIONS['sc-copy'] = function (b) { Native.call('copy', { text: b.getAttribute('data-v').replace('…', '') }).catch(function () {}); A.toast('نُسخ الرابط'); };

/* tell native we're ready to receive queued launch actions */
function ready() { Native.call('ready', {}).catch(function () {}); }
if (document.readyState === 'complete') setTimeout(ready, 0); else window.addEventListener('load', function () { setTimeout(ready, 0); });
})();
