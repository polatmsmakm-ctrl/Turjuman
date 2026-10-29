'use strict';
/* American English pronunciation engine.
   CMUdict (ARPAbet) -> IPA (General American, with stress and flap T) and an Arabic-letter guide.
   Works on whole sentences. Data is loaded lazily from pron.js. */
window.Pron = (function () {
  var map = null, dec = null, loading = null;

  function load() {
    if (map) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      function build() {
        var syms = window.__CMU_SYMS, list = window.__CMU_LIST, s = window.__CMU;
        dec = {};
        for (var i = 0; i < syms.length; i++) dec[syms[i]] = list[i];
        map = new Map();
        var pos = 0, n = s.length;
        while (pos < n) {
          var nl = s.indexOf('\n', pos); if (nl < 0) nl = n;
          var sp = s.indexOf(' ', pos);
          map.set(s.slice(pos, sp), s.slice(sp + 1, nl));
          pos = nl + 1;
        }
        window.__CMU = null;
        res();
      }
      if (window.__CMU) { build(); return; }
      var sc = document.createElement('script');
      sc.src = 'pron.js';
      sc.onload = build;
      sc.onerror = function () { loading = null; rej(new Error('pron_load')); };
      document.head.appendChild(sc);
    });
    return loading;
  }

  function decode(code) { var out = []; for (var i = 0; i < code.length; i++) out.push(dec[code[i]]); return out; }
  function base(p) { return p.replace(/\d/, ''); }
  function isV(p) { return /\d$/.test(p); }
  function stressOf(p) { var m = p.match(/(\d)$/); return m ? +m[1] : -1; }
  function get(w) { var c = map.get(w); return c == null ? null : decode(c); }
  function last(ph) { return base(ph[ph.length - 1]); }

  function addS(ph) {
    var l = last(ph);
    if (['S', 'Z', 'SH', 'ZH', 'CH', 'JH'].indexOf(l) >= 0) return ph.concat(['IH0', 'Z']);
    if (['P', 'T', 'K', 'F', 'TH'].indexOf(l) >= 0) return ph.concat(['S']);
    return ph.concat(['Z']);
  }
  function addED(ph) {
    var l = last(ph);
    if (l === 'T' || l === 'D') return ph.concat(['IH0', 'D']);
    if (['P', 'K', 'F', 'TH', 'S', 'SH', 'CH'].indexOf(l) >= 0) return ph.concat(['T']);
    return ph.concat(['D']);
  }
  function undouble(s) { return /([bcdfgklmnprstvz])\1$/.test(s) ? s.slice(0, -1) : null; }

  /* word -> {ph, known} ; tries the dictionary, then regular English endings */
  function lookup(word) {
    var w = word.toLowerCase().replace(/[’‘]/g, "'");
    var ph = get(w); if (ph) return ph;
    var m, st;
    if ((m = w.match(/^(.+)'s$/)) && (st = get(m[1]))) return addS(st);
    if ((m = w.match(/^(.+s)'$/)) && (st = get(m[1]))) return st;
    if (/ies$/.test(w) && (st = get(w.slice(0, -3) + 'y'))) return addS(st);
    if (/es$/.test(w) && (st = get(w.slice(0, -2)))) return addS(st);
    if (/s$/.test(w) && (st = get(w.slice(0, -1)))) return addS(st);
    if (/ied$/.test(w) && (st = get(w.slice(0, -3) + 'y'))) return addED(st);
    if (/ed$/.test(w)) {
      var a = w.slice(0, -2), b = w.slice(0, -1), c = undouble(a);
      st = get(a) || get(b) || (c && get(c)); if (st) return addED(st);
    }
    if (/ing$/.test(w)) {
      var s1 = w.slice(0, -3), d = undouble(s1);
      st = get(s1) || get(s1 + 'e') || (d && get(d)); if (st) return st.concat(['IH0', 'NG']);
    }
    if (/ly$/.test(w)) {
      st = get(w.slice(0, -2)) || (/ily$/.test(w) && get(w.slice(0, -3) + 'y'));
      if (st) return st.concat(['L', 'IY0']);
    }
    if (/ness$/.test(w) && (st = get(w.slice(0, -4)))) return st.concat(['N', 'AH0', 'S']);
    if (/less$/.test(w) && (st = get(w.slice(0, -4)))) return st.concat(['L', 'AH0', 'S']);
    if (/ful$/.test(w) && (st = get(w.slice(0, -3)))) return st.concat(['F', 'AH0', 'L']);
    if (/est$/.test(w) && (st = get(w.slice(0, -3)) || get(w.slice(0, -2)))) return st.concat(['AH0', 'S', 'T']);
    if (/er$/.test(w) && (st = get(w.slice(0, -2)) || get(w.slice(0, -1)))) return st.concat(['ER0']);
    if (w.indexOf('-') > 0) {
      var parts = w.split('-').map(lookup);
      if (parts.every(Boolean)) return [].concat.apply([], parts);
    }
    return null;
  }

  /* ---------- IPA (General American) ---------- */
  var IV = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u' };
  var IC = { B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
  var ONSETS = new Set(('P R|P L|B R|B L|T R|D R|K R|K L|G R|G L|F R|F L|TH R|SH R|S P|S T|S K|S M|S N|S L|S W|S F|T W|D W|K W|G W|TH W|' +
    'P Y|B Y|F Y|M Y|K Y|V Y|HH Y|S P R|S T R|S K R|S P L|S K W|S P Y|S K Y|S K L').split('|'));
  function legalOnset(cons) {
    if (!cons.length) return true;
    if (cons.length === 1) return cons[0] !== 'NG';
    return ONSETS.has(cons.join(' '));
  }
  function flapped(ph, i) {
    var b = base(ph[i]);
    if ((b !== 'T' && b !== 'D') || i === 0 || i === ph.length - 1) return false;
    var prev = ph[i - 1], next = ph[i + 1];
    return (isV(prev) || base(prev) === 'R') && isV(next) && stressOf(next) === 0;
  }
  function ipaWord(ph) {
    var segs = ph.map(function (p, i) {
      if (isV(p)) {
        var b = base(p), s = stressOf(p);
        if (b === 'AH' && s === 0) return 'ə';
        if (b === 'ER' && s === 0) return 'ɚ';
        return IV[b];
      }
      return flapped(ph, i) ? 'ɾ' : IC[p];
    });
    var vIdx = [];
    ph.forEach(function (p, i) { if (isV(p)) vIdx.push(i); });
    var marks = {};
    if (vIdx.length > 1) {
      vIdx.forEach(function (vi, n) {
        var s = stressOf(ph[vi]); if (s !== 1 && s !== 2) return;
        var start = n === 0 ? 0 : vIdx[n - 1] + 1;
        var cons = ph.slice(start, vi).map(base);
        var k = cons.length;
        while (k > 0 && !legalOnset(cons.slice(cons.length - k))) k--;
        var at = n === 0 ? 0 : vi - k;
        marks[at] = s === 1 ? 'ˈ' : 'ˌ';
      });
    }
    return segs.map(function (s, i) { return (marks[i] || '') + s; }).join('');
  }

  /* ---------- Arabic-letter guide ---------- */
  var AC = { B: 'ب', CH: 'تش', D: 'د', DH: 'ذ', F: 'ف', G: 'گ', HH: 'ه', JH: 'ج', K: 'ك', L: 'ل', M: 'م', N: 'ن', NG: 'نگ', P: 'پ', R: 'ر', S: 'س', SH: 'ش', T: 'ت', TH: 'ث', V: 'ڤ', W: 'و', Y: 'ي', Z: 'ز', ZH: 'ژ' };
  var AMID = { AA: 'ا', AE: 'ا', AH: 'َ', AO: 'ا', AW: 'او', AY: 'اي', EH: 'ِ', ER: 'ِر', EY: 'َي', IH: 'ِ', IY: 'ي', OW: 'و', OY: 'وي', UH: 'ُ', UW: 'و' };
  var AINI = { AA: 'آ', AE: 'آ', AH: 'أَ', AO: 'آ', AW: 'آو', AY: 'آي', EH: 'إِ', ER: 'أَر', EY: 'إي', IH: 'إِ', IY: 'إي', OW: 'أو', OY: 'أوي', UH: 'أُ', UW: 'أو' };
  var I_LIKE = ['IY', 'IH', 'EY', 'AY', 'OY'], U_LIKE = ['UW', 'OW', 'AW', 'UH'];
  function arabicWord(ph) {
    var out = '', nV = ph.filter(isV).length;
    ph.forEach(function (p, i) {
      var b = base(p), s = stressOf(p), end = i === ph.length - 1;
      if (isV(p)) {
        if (i === 0) { out += AINI[b]; return; }
        var prev = ph[i - 1];
        if (isV(prev) && base(prev) !== 'ER') {
          var pb = base(prev);
          out += (I_LIKE.indexOf(pb) >= 0 ? 'ي' : U_LIKE.indexOf(pb) >= 0 ? 'و' : 'ء');
        }
        if (b === 'AH' && s === 0 && end && nV > 1) { out += 'ا'; return; }
        if (b === 'ER' && s === 0) { out += 'َر'; return; }
        out += AMID[b];
        return;
      }
      if (flapped(ph, i)) { out += 'د'; return; }
      if (b === 'NG' && i + 1 < ph.length && (base(ph[i + 1]) === 'K' || base(ph[i + 1]) === 'G')) { out += 'ن'; return; }
      out += AC[b];
    });
    return out;
  }

  /* ---------- numbers -> words ---------- */
  var ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
  var TENS = ' ten twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
  function numWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numWords(n % 100) : '');
    var units = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) return numWords(Math.floor(n / units[i][0])) + ' ' + units[i][1] + (n % units[i][0] ? ' ' + numWords(n % units[i][0]) : '');
    }
    return String(n);
  }
  function numberText(tok) {
    var clean = tok.replace(/,/g, '');
    var m = clean.match(/^(\d+)(?:\.(\d+))?$/);
    if (!m || m[1].length > 12) return null;
    var t = numWords(parseInt(m[1], 10));
    if (m[2]) t += ' point ' + m[2].split('').map(function (d) { return ONES[+d]; }).join(' ');
    return t;
  }

  /* ---------- sentence analysis ---------- */
  var TOKEN = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*|\d+(?:[.,]\d+)*/g;

  function wordInfo(w) {
    var ph = lookup(w);
    if (!ph) return { text: w, known: false };
    return { text: w, known: true, ipa: ipaWord(ph), ar: arabicWord(ph) };
  }

  /* text -> {sentences:[{words:[{text,known,ipa,ar}] , ipa, ar}], count, truncated} */
  function analyze(text, maxWords) {
    maxWords = maxWords || 150;
    var sentences = [], count = 0, truncated = false;
    var parts = String(text).replace(/\s+/g, ' ').match(/[^.!?؟\n]+[.!?؟]*/g) || [];
    for (var i = 0; i < parts.length && !truncated; i++) {
      var words = [], m;
      TOKEN.lastIndex = 0;
      while ((m = TOKEN.exec(parts[i]))) {
        if (count >= maxWords) { truncated = true; break; }
        var tok = m[0];
        if (/^\d/.test(tok)) {
          var nt = numberText(tok);
          if (nt) {
            var infos = nt.split(' ').map(wordInfo);
            words.push({ text: tok, known: infos.every(function (x) { return x.known; }),
              ipa: infos.map(function (x) { return x.ipa || x.text; }).join(' '),
              ar: infos.map(function (x) { return x.ar || x.text; }).join(' ') });
          } else words.push({ text: tok, known: false });
        } else words.push(wordInfo(tok));
        count++;
      }
      if (words.length) {
        sentences.push({
          words: words,
          ipa: words.map(function (w) { return w.known ? w.ipa : w.text; }).join(' '),
          ar: words.map(function (w) { return w.known ? w.ar : '⁦' + w.text + '⁩'; }).join(' ')
        });
      }
    }
    return { sentences: sentences, count: count, truncated: truncated };
  }

  /* word -> [{ipa, stress (0/1/2), arpa:[...] }] syllables split with the maximal-onset rule */
  function syllables(w) {
    var ph = lookup(w);
    if (!ph) return null;
    var vIdx = [];
    ph.forEach(function (p, i) { if (isV(p)) vIdx.push(i); });
    if (!vIdx.length) return null;
    var starts = vIdx.map(function (vi, n) {
      if (n === 0) return 0;
      var start = vIdx[n - 1] + 1, cons = ph.slice(start, vi).map(base), k = cons.length;
      while (k > 0 && !legalOnset(cons.slice(cons.length - k))) k--;
      return vi - k;
    });
    return starts.map(function (st, n) {
      var end = n + 1 < starts.length ? starts[n + 1] : ph.length;
      var part = ph.slice(st, end);
      var ipa = part.map(function (p, j) {
        var i = st + j;
        if (isV(p)) { var b = base(p), s2 = stressOf(p); if (b === 'AH' && s2 === 0) return 'ə'; if (b === 'ER' && s2 === 0) return 'ɚ'; return IV[b]; }
        return flapped(ph, i) ? 'ɾ' : IC[p];
      }).join('');
      return { ipa: ipa, stress: stressOf(ph[vIdx[n]]), arpa: part };
    });
  }

  return { load: load, analyze: analyze, word: function (w) { return wordInfo(w); }, syllables: syllables, ready: function () { return !!map; } };
})();
