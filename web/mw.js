'use strict';
/* Merriam‑Webster everywhere: a "MW" tool in the tools strip, a result action, and word-by-word lookup for any sentence. */
(function () {
var A = window.App, esc = A.esc, icon = A.icon;

function englishText(r) {
  if (!r) return '';
  if (r.sl === 'en') return r.source || '';
  if (r.tl === 'en') return r.text || '';
  return '';
}
function wordsOf(t) {
  var seen = {}, out = [];
  (String(t).match(/[A-Za-z][A-Za-z'’\-]*/g) || []).forEach(function (w) {
    w = w.replace(/’/g, "'").replace(/^['\-]+|['\-]+$/g, '');
    var k = w.toLowerCase();
    if (k.length < 2 || seen[k]) return;
    seen[k] = 1; out.push(k);
  });
  return out.slice(0, 40);
}
function open(word) {
  var r = A.T.result, txt = englishText(r);
  if (!txt && !word) { A.toast('ما فيه نص إنجليزي لعرض تعريفه'); return; }
  var words = wordsOf(txt);
  if (word && words.indexOf(word.toLowerCase()) < 0) words.unshift(word.toLowerCase());
  var first = word || (words.length === 1 ? words[0] : '');
  A.openModal('<h3>Merriam‑Webster</h3>' +
    (words.length > 1 ? '<div class="chips mw-words">' + words.map(function (w) { return '<button type="button" class="chip" data-act="mw-word" data-w="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div>' : '') +
    '<div id="mwBox" class="block">' + (first ? '' : '<div class="empty">اختر كلمة من فوق لعرض تعريفها.</div>') + '</div>');
  if (first) pick(first);
}
function pick(w) {
  Array.prototype.forEach.call(document.querySelectorAll('.mw-words .chip'), function (c) { c.classList.toggle('is-sel', c.getAttribute('data-w') === w); });
  var box = document.getElementById('mwBox'); if (!box) return;
  A.showLookup(box, w, { compact: true });
}
A.ACTIONS['mw-word'] = function (b) { pick(b.getAttribute('data-w')); };
A.openMW = open;

A.addResultAction({ id: 'mw', label: 'تعريف Merriam‑Webster', sub: 'اضغط أي كلمة في الجملة وشوف تعريفها ونطقها', icon: 'book', order: 5,
  when: function (r) { return r && (r.sl === 'en' || r.tl === 'en'); }, run: function () { open(); } });
A.addTool({ id: 'mw', label: 'MW', icon: 'book', order: 8, run: function () { open(); } });
})();
