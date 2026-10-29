'use strict';
/* Learning data written for Turjuman: irregular verbs & plurals, confusable words, travel phrasebook, connected speech, minimal pairs. */
window.TJD = window.TJD || {};

/* base|past|past participle (alternatives with /) */
TJD.irregularVerbs = ('arise|arose|arisen;awake|awoke|awoken;be|was/were|been;bear|bore|borne;beat|beat|beaten;become|became|become;begin|began|begun;' +
  'bend|bent|bent;bet|bet|bet;bid|bid|bid;bind|bound|bound;bite|bit|bitten;bleed|bled|bled;blow|blew|blown;break|broke|broken;breed|bred|bred;' +
  'bring|brought|brought;broadcast|broadcast|broadcast;build|built|built;burn|burned/burnt|burned/burnt;burst|burst|burst;buy|bought|bought;' +
  'cast|cast|cast;catch|caught|caught;choose|chose|chosen;cling|clung|clung;come|came|come;cost|cost|cost;creep|crept|crept;cut|cut|cut;' +
  'deal|dealt|dealt;dig|dug|dug;do|did|done;draw|drew|drawn;dream|dreamed/dreamt|dreamed/dreamt;drink|drank|drunk;drive|drove|driven;' +
  'eat|ate|eaten;fall|fell|fallen;feed|fed|fed;feel|felt|felt;fight|fought|fought;find|found|found;flee|fled|fled;fling|flung|flung;fly|flew|flown;' +
  'forbid|forbade|forbidden;forecast|forecast|forecast;forget|forgot|forgotten;forgive|forgave|forgiven;freeze|froze|frozen;get|got|gotten/got;' +
  'give|gave|given;go|went|gone;grind|ground|ground;grow|grew|grown;hang|hung|hung;have|had|had;hear|heard|heard;hide|hid|hidden;hit|hit|hit;' +
  'hold|held|held;hurt|hurt|hurt;keep|kept|kept;kneel|knelt|knelt;know|knew|known;lay|laid|laid;lead|led|led;lean|leaned/leant|leaned/leant;' +
  'leap|leaped/leapt|leaped/leapt;learn|learned/learnt|learned/learnt;leave|left|left;lend|lent|lent;let|let|let;lie|lay|lain;light|lit/lighted|lit/lighted;' +
  'lose|lost|lost;make|made|made;mean|meant|meant;meet|met|met;mislead|misled|misled;mistake|mistook|mistaken;misunderstand|misunderstood|misunderstood;' +
  'overcome|overcame|overcome;oversleep|overslept|overslept;overtake|overtook|overtaken;pay|paid|paid;prove|proved|proven/proved;put|put|put;' +
  'quit|quit|quit;read|read|read;ride|rode|ridden;ring|rang|rung;rise|rose|risen;run|ran|run;say|said|said;see|saw|seen;seek|sought|sought;' +
  'sell|sold|sold;send|sent|sent;set|set|set;sew|sewed|sewn;shake|shook|shaken;shed|shed|shed;shine|shone|shone;shoot|shot|shot;show|showed|shown;' +
  'shrink|shrank|shrunk;shut|shut|shut;sing|sang|sung;sink|sank|sunk;sit|sat|sat;sleep|slept|slept;slide|slid|slid;speak|spoke|spoken;' +
  'speed|sped|sped;spell|spelled/spelt|spelled/spelt;spend|spent|spent;spill|spilled/spilt|spilled/spilt;spin|spun|spun;spit|spat|spat;split|split|split;' +
  'spoil|spoiled/spoilt|spoiled/spoilt;spread|spread|spread;spring|sprang|sprung;stand|stood|stood;steal|stole|stolen;stick|stuck|stuck;sting|stung|stung;' +
  'stink|stank|stunk;strike|struck|struck;string|strung|strung;strive|strove|striven;swear|swore|sworn;sweep|swept|swept;swell|swelled|swollen;' +
  'swim|swam|swum;swing|swung|swung;take|took|taken;teach|taught|taught;tear|tore|torn;tell|told|told;think|thought|thought;throw|threw|thrown;' +
  'tread|trod|trodden;understand|understood|understood;undertake|undertook|undertaken;upset|upset|upset;wake|woke|woken;wear|wore|worn;' +
  'weave|wove|woven;weep|wept|wept;wet|wet|wet;win|won|won;wind|wound|wound;withdraw|withdrew|withdrawn;wring|wrung|wrung;write|wrote|written')
  .split(';').map(function (x) { return x.split('|'); });

TJD.irregularPlurals = {
  man: 'men', woman: 'women', child: 'children', person: 'people', foot: 'feet', tooth: 'teeth', goose: 'geese', mouse: 'mice', ox: 'oxen',
  sheep: 'sheep', deer: 'deer', fish: 'fish', species: 'species', series: 'series', aircraft: 'aircraft', means: 'means',
  analysis: 'analyses', basis: 'bases', crisis: 'crises', diagnosis: 'diagnoses', hypothesis: 'hypotheses', thesis: 'theses', parenthesis: 'parentheses',
  phenomenon: 'phenomena', criterion: 'criteria', datum: 'data', medium: 'media', bacterium: 'bacteria', curriculum: 'curricula',
  cactus: 'cacti', fungus: 'fungi', nucleus: 'nuclei', stimulus: 'stimuli', syllabus: 'syllabi', radius: 'radii', alumnus: 'alumni',
  appendix: 'appendices', index: 'indices', matrix: 'matrices', vertex: 'vertices',
  knife: 'knives', life: 'lives', wife: 'wives', leaf: 'leaves', half: 'halves', wolf: 'wolves', shelf: 'shelves', thief: 'thieves', loaf: 'loaves', calf: 'calves', self: 'selves', elf: 'elves',
  potato: 'potatoes', tomato: 'tomatoes', hero: 'heroes', echo: 'echoes', veto: 'vetoes', torpedo: 'torpedoes',
  photo: 'photos', piano: 'pianos', radio: 'radios', video: 'videos', zoo: 'zoos', kilo: 'kilos', memo: 'memos', roof: 'roofs', chief: 'chiefs', belief: 'beliefs', chef: 'chefs', cliff: 'cliffs'
};
TJD.uncountable = 'advice information news furniture luggage baggage equipment homework research knowledge evidence progress traffic money water rice bread music weather work travel accommodation feedback software hardware'.split(' ');
TJD.irregularAdj = { good: ['better', 'best'], bad: ['worse', 'worst'], far: ['farther/further', 'farthest/furthest'], little: ['less', 'least'], many: ['more', 'most'], much: ['more', 'most'], well: ['better', 'best'], old: ['older/elder', 'oldest/eldest'] };

/* Words that Arabic speakers often confuse. [words, Arabic explanation, examples] */
TJD.confusables = [
  [['affect', 'effect'], 'affect فعل بمعنى «يؤثّر على»، وeffect اسم بمعنى «تأثير/نتيجة».', ['The weather affects my mood.', 'The new law had a big effect.']],
  [['borrow', 'lend'], 'borrow تستلف من أحد (تاخذ)، وlend تسلّف أحد (تعطي).', ['Can I borrow your pen?', 'Can you lend me your pen?']],
  [['say', 'tell'], 'tell لازم بعدها الشخص: tell him. وsay ما يجي بعدها الشخص مباشرة: say something (to him).', ['She told me the truth.', 'She said that she was tired.']],
  [['make', 'do'], 'make للصنع والإنتاج (make a cake, make a decision)، وdo للمهام والأعمال (do homework, do the dishes).', ['I made a mistake.', 'I did my homework.']],
  [['bored', 'boring'], 'bored = أنا أحس بالملل، boring = الشي نفسه ممل. ونفس القاعدة: interested/interesting، tired/tiring.', ['I am bored.', 'This film is boring.']],
  [['fun', 'funny'], 'fun = ممتع ووناسة، funny = يضحّك.', ['The trip was fun.', 'That joke is funny.']],
  [['lose', 'loose'], 'lose فعل «يضيّع/يخسر»، وloose صفة «واسع/مرتخي».', ["Don't lose your keys.", 'These pants are loose.']],
  [['rise', 'raise'], 'rise يرتفع لحاله (بدون مفعول)، وraise ترفع شي (لازم مفعول).', ['The sun rises in the east.', 'Raise your hand.']],
  [['lie', 'lay'], 'lie = يستلقي (بدون مفعول)، lay = يحط شي (لازم مفعول). وماضي lie هو lay، فانتبه.', ['I lie down after lunch.', 'Lay the book on the table.']],
  [['remember', 'remind'], 'remember = أنت تتذكر، remind = تذكّر أحد ثاني بشي.', ['I remember his name.', 'Remind me to call him.']],
  [['hear', 'listen'], 'hear السمع بدون قصد، listen تسمع بانتباه وقصد (listen to).', ['I heard a noise.', 'Listen to the teacher.']],
  [['see', 'look', 'watch'], 'see تشوف بدون قصد، look تطالع بقصد (look at)، watch تتابع شي يتحرك أو مدة (watch TV).', ['I saw a bird.', 'Look at this picture.', 'We watched the match.']],
  [['rob', 'steal'], 'steal تسرق الشي (steal money)، rob تسرق المكان أو الشخص (rob a bank).', ['Someone stole my phone.', 'They robbed the bank.']],
  [['win', 'earn'], 'win تفوز بجائزة أو مباراة، earn تكسب فلوس من شغلك.', ['We won the game.', 'She earns a good salary.']],
  [['its', "it's"], "its = حقه/حقها (ملكية)، it's = it is أو it has.", ['The dog wagged its tail.', "It's raining."]],
  [['their', 'there', "they're"], "their = حقهم، there = هناك، they're = they are.", ['Their house is big.', 'Put it there.', "They're coming."]],
  [['your', "you're"], "your = حقك، you're = you are.", ['Is this your bag?', "You're right."]],
  [['then', 'than'], 'then = بعدين/وقتها، than للمقارنة (أكبر من).', ['We ate, then we left.', 'He is taller than me.']],
  [['since', 'for'], 'since مع نقطة بداية (since 2020)، for مع مدة (for three years).', ['I have lived here since 2020.', 'I have lived here for three years.']],
  [['during', 'for'], 'during = خلال حدث معيّن (during the meeting)، for = مدة (for two hours).', ['He slept during the movie.', 'He slept for two hours.']],
  [['actually', 'currently'], 'actually معناها «في الحقيقة» مو «حاليًا». «حاليًا» = currently أو at the moment.', ['Actually, I disagree.', 'I am currently in Dubai.']],
  [['control', 'check'], '«يكنترل» بمعنى يفحص = check مو control. control = يتحكم ويسيطر.', ['Check your answers.', 'He controls the company.']],
  [['attend', 'assist'], 'attend = يحضر (اجتماع/محاضرة)، assist = يساعد.', ['I attended the meeting.', 'Can I assist you?']],
  [['sensible', 'sensitive'], 'sensible = عاقل/منطقي، sensitive = حساس.', ['That is a sensible decision.', 'My skin is sensitive.']],
  [['economic', 'economical'], 'economic = متعلق بالاقتصاد، economical = موفّر/ما يصرف كثير.', ['economic growth', 'This car is economical.']],
  [['historic', 'historical'], 'historic = تاريخي بمعنى مهم ومشهور، historical = يخص التاريخ والماضي.', ['a historic victory', 'historical documents']],
  [['especially', 'specially'], 'especially = خصوصًا، specially = مخصوص لغرض معيّن.', ['I love fruit, especially mangoes.', 'This cake was specially made for you.']],
  [['advice', 'advise'], 'advice اسم (نصيحة) وما ينجمع، advise فعل (ينصح).', ['He gave me good advice.', 'I advise you to rest.']],
  [['accept', 'except'], 'accept = يقبل، except = ما عدا.', ['I accept your offer.', 'Everyone came except Ali.']],
  [['quiet', 'quite'], 'quiet = هادي، quite = إلى حد كبير/نوعًا ما.', ['The library is quiet.', 'It is quite cold.']],
  [['fewer', 'less'], 'fewer مع الأشياء اللي تنعد (fewer cars)، less مع اللي ما تنعد (less water).', ['fewer people', 'less time']],
  [['among', 'between'], 'between بين شيئين أو أشياء محددة، among وسط مجموعة.', ['between you and me', 'among friends']],
  [['alone', 'lonely'], 'alone = لحالك (حقيقة)، lonely = تحس بالوحدة (شعور).', ['I live alone.', 'I feel lonely.']],
  [['job', 'work'], 'job وظيفة وتنعد (a job)، work الشغل بشكل عام وما ينعد (I have work).', ['I found a new job.', 'I have a lot of work.']],
  [['travel', 'trip', 'journey'], 'travel السفر عمومًا (فعل/اسم عام)، trip رحلة قصيرة وترجع، journey المشوار نفسه من مكان لمكان.', ['I love to travel.', 'We took a trip to Paris.', 'The journey took six hours.']],
  [['price', 'prize'], 'price = سعر، prize = جائزة.', ['What is the price?', 'She won first prize.']],
  [['personal', 'personnel'], 'personal = شخصي، personnel = الموظفين/شؤون الموظفين.', ['a personal question', 'military personnel']],
  [['beside', 'besides'], 'beside = جنب، besides = بالإضافة إلى/غير كذا.', ['Sit beside me.', 'Besides English, he speaks French.']],
  [['principal', 'principle'], 'principal = رئيسي أو مدير المدرسة، principle = مبدأ.', ['the school principal', 'a man of principle']],
  [['complement', 'compliment'], 'complement = يكمّل، compliment = مدح/مجاملة.', ['The colors complement each other.', 'Thanks for the compliment!']],
  [['desert', 'dessert'], 'desert = صحراء (DEZ-ert)، dessert = حلى (di-ZURT).', ['the Arabian desert', 'Chocolate cake for dessert.']],
  [['live', 'life'], 'live فعل (يعيش)، life اسم (حياة).', ['I live in Kuwait.', 'Life is beautiful.']],
  [['custom', 'costume'], 'custom = عادة/تقليد، costume = زي/لبس تنكري.', ['It is a local custom.', 'a Halloween costume']],
  [['already', 'all ready'], 'already = خلاص/من قبل، all ready = الكل جاهز.', ['I have already eaten.', 'We are all ready to go.']],
  [['every day', 'everyday'], 'every day (كلمتين) = كل يوم، everyday (كلمة وحدة) = يومي/عادي.', ['I walk every day.', 'everyday clothes']],
  [['stationary', 'stationery'], 'stationary = واقف/ثابت، stationery = قرطاسية.', ['a stationary car', 'a stationery shop']],
  [['bring', 'take'], 'bring تجيب شي لمكانك أنت، take تاخذ شي لمكان ثاني.', ['Bring me some water.', 'Take this to your mother.']],
  [['come', 'go'], 'come تجي لمكان المتكلم، go تروح بعيد عنه.', ['Come here!', 'Go home.']]
];

/* Travel phrasebook: category → [Arabic, English] */
TJD.phrasebook = [
  { id: 'basics', title: 'أساسيات', icon: 'chat', items: [
    ['مرحبًا', 'Hello'], ['صباح الخير', 'Good morning'], ['شكرًا جزيلًا', 'Thank you very much'], ['لو سمحت', 'Excuse me'], ['آسف', "I'm sorry"],
    ['نعم / لا', 'Yes / No'], ['ما فهمت', "I don't understand"], ['تتكلم عربي أو إنجليزي؟', 'Do you speak Arabic or English?'],
    ['ممكن تتكلم ببطء؟', 'Could you speak more slowly, please?'], ['ممكن تكتبها لي؟', 'Could you write it down for me?'], ['كم الساعة؟', 'What time is it?'] ] },
  { id: 'airport', title: 'المطار', icon: 'plane', items: [
    ['وين كاونتر تسجيل الدخول؟', 'Where is the check-in counter?'], ['أبي مقعد جنب الشباك', "I'd like a window seat, please."], ['كم وزن الشنط المسموح؟', 'What is the baggage allowance?'],
    ['من أي بوابة الرحلة؟', 'Which gate does the flight leave from?'], ['الرحلة متأخرة؟', 'Is the flight delayed?'], ['ضاعت شنطتي', 'My luggage is lost.'],
    ['وين استلام الأمتعة؟', 'Where is baggage claim?'], ['أنا هنا سياحة لمدة أسبوع', "I'm here on vacation for a week."], ['وين أقدر أصرف فلوس؟', 'Where can I exchange money?'], ['عندي رحلة ترانزيت', 'I have a connecting flight.'] ] },
  { id: 'hotel', title: 'الفندق', icon: 'bell', items: [
    ['عندي حجز باسم…', 'I have a reservation under the name…'], ['أبي غرفة لشخصين', "I'd like a room for two people."], ['كم سعر الليلة؟', 'How much is it per night?'],
    ['الفطور داخل في السعر؟', 'Is breakfast included?'], ['متى وقت تسجيل الخروج؟', 'What time is check-out?'], ['المكيف ما يشتغل', "The air conditioning isn't working."],
    ['ممكن مناشف زيادة؟', 'Could I have some extra towels?'], ['وش باسورد الواي فاي؟', 'What is the Wi-Fi password?'], ['ممكن تطلب لي تاكسي؟', 'Could you call me a taxi?'], ['ممكن أترك شنطتي عندكم؟', 'Can I leave my luggage here?'] ] },
  { id: 'food', title: 'المطعم', icon: 'star', items: [
    ['طاولة لأربعة لو سمحت', 'A table for four, please.'], ['ممكن المنيو؟', 'Could we see the menu, please?'], ['وش تنصحني آكل؟', 'What do you recommend?'],
    ['هل الأكل حلال؟', 'Is the food halal?'], ['فيه لحم خنزير؟', 'Does this contain pork?'], ['بدون كحول لو سمحت', 'No alcohol, please.'],
    ['عندي حساسية من المكسرات', "I'm allergic to nuts."], ['أبيه مو حار', 'Not spicy, please.'], ['الحساب لو سمحت', 'Could we have the check, please?'], ['أقدر أدفع بالبطاقة؟', 'Can I pay by card?'] ] },
  { id: 'transport', title: 'المواصلات', icon: 'link', items: [
    ['وين أقرب محطة مترو؟', 'Where is the nearest metro station?'], ['كم الأجرة إلى هذا العنوان؟', 'How much is the fare to this address?'], ['ودّني هذا العنوان لو سمحت', 'Please take me to this address.'],
    ['شغّل العداد لو سمحت', 'Please turn on the meter.'], ['وقف هنا لو سمحت', 'Please stop here.'], ['متى يطلع الباص الجاي؟', 'When does the next bus leave?'],
    ['تذكرة ذهاب وعودة', 'A round-trip ticket, please.'], ['هذا القطار يروح إلى…؟', 'Does this train go to…?'], ['أبي أستأجر سيارة', "I'd like to rent a car."], ['وين أوقف السيارة؟', 'Where can I park?'] ] },
  { id: 'directions', title: 'الاتجاهات', icon: 'search', items: [
    ['وين…؟', 'Where is…?'], ['كيف أروح إلى…؟', 'How do I get to…?'], ['بعيد من هنا؟', 'Is it far from here?'], ['أقدر أمشي له؟', 'Can I walk there?'],
    ['يمين / يسار / سيدا', 'Right / left / straight ahead'], ['ضعت، ممكن تساعدني؟', "I'm lost. Can you help me?"], ['وريني على الخريطة', 'Can you show me on the map?'],
    ['وين أقرب حمام؟', 'Where is the nearest restroom?'], ['وين أقرب مسجد؟', 'Where is the nearest mosque?'], ['وين أقرب صراف آلي؟', 'Where is the nearest ATM?'] ] },
  { id: 'shopping', title: 'التسوق', icon: 'cards', items: [
    ['بكم هذا؟', 'How much is this?'], ['غالي شوي، فيه خصم؟', "It's a bit expensive. Is there a discount?"], ['عندك مقاس أكبر؟', 'Do you have this in a bigger size?'],
    ['أقدر أجربه؟', 'Can I try it on?'], ['بس أتفرج، شكرًا', "I'm just looking, thanks."], ['آخذه', "I'll take it."],
    ['أقدر أرجّعه؟', 'Can I return it?'], ['ممكن الفاتورة؟', 'Could I have the receipt?'], ['فيه استرجاع ضريبة؟', 'Can I get a tax refund?'], ['متى تسكرون؟', 'What time do you close?'] ] },
  { id: 'health', title: 'الصحة', icon: 'medical', items: [
    ['أحتاج دكتور', 'I need a doctor.'], ['وين أقرب صيدلية؟', 'Where is the nearest pharmacy?'], ['عندي صداع', 'I have a headache.'],
    ['عندي حرارة', 'I have a fever.'], ['أحس بدوخة', 'I feel dizzy.'], ['عندي سكري', 'I have diabetes.'],
    ['عندي حساسية من البنسلين', "I'm allergic to penicillin."], ['أبي دوا للكحة', "I'd like something for a cough."], ['كم مرة آخذه باليوم؟', 'How many times a day should I take it?'], ['عندي تأمين صحي', 'I have travel insurance.'] ] },
  { id: 'emergency', title: 'الطوارئ', icon: 'bell', items: [
    ['النجدة!', 'Help!'], ['اتصلوا بالإسعاف', 'Call an ambulance!'], ['اتصلوا بالشرطة', 'Call the police!'], ['انسرق جوالي', 'My phone was stolen.'],
    ['ضاع جوازي', "I've lost my passport."], ['وين السفارة؟', 'Where is the embassy?'], ['صار حادث', 'There has been an accident.'], ['حريق!', 'Fire!'],
    ['أحتاج مساعدة', 'I need help.'], ['ممكن أستخدم جوالك؟', 'Can I use your phone?'] ] },
  { id: 'talk', title: 'التعارف', icon: 'listen', items: [
    ['وش اسمك؟', "What's your name?"], ['اسمي…', 'My name is…'], ['أنا من الكويت', "I'm from Kuwait."], ['تشرفنا', 'Nice to meet you.'],
    ['كيف حالك؟', 'How are you?'], ['وش تشتغل؟', 'What do you do for work?'], ['أول مرة أجي هنا', "It's my first time here."], ['المكان مرة حلو', 'This place is really beautiful.'],
    ['ممكن نتصوّر؟', 'Can we take a photo?'], ['مع السلامة', 'Goodbye.'] ] }
];

/* 44. Connected speech: how natives actually say common phrases */
TJD.connected = [
  ['want to', 'wanna', 'وانا', 'I wanna go home.'], ['going to', 'gonna', 'قونا', "I'm gonna call you."], ['got to', 'gotta', 'قاتا', 'I gotta go.'],
  ['have to', 'hafta', 'هافتا', 'I hafta work.'], ['kind of', 'kinda', 'كايندا', "It's kinda cold."], ['sort of', 'sorta', 'سورتا', "It's sorta weird."],
  ['let me', 'lemme', 'ليمي', 'Lemme see.'], ['give me', 'gimme', 'قيمي', 'Gimme a minute.'], ["don't know", 'dunno', 'دنو', 'I dunno.'],
  ['what do you', 'whaddaya', 'وادايا', 'Whaddaya want?'], ['did you', 'didja', 'دِجا', 'Didja see that?'], ['would you', 'wouldja', 'وُدجا', 'Wouldja help me?'],
  ['could have', "could've / coulda", 'كودا', 'I coulda won.'], ['should have', "should've / shoulda", 'شودا', 'You shoulda told me.'], ['would have', "would've / woulda", 'وودا', 'I woulda come.'],
  ['a lot of', 'a lotta', 'ألاتا', 'A lotta people.'], ['out of', 'outta', 'أوتا', 'Get outta here.'], ['because', "'cause / cuz", 'كوز', "'Cause I said so."],
  ['you all', "y'all", 'يول', "Y'all ready?"], ['come on', "c'mon", 'كمان', "C'mon, let's go."], ['what are you', 'whatcha', 'واتشا', 'Whatcha doing?'],
  ['got you', 'gotcha', 'قاتشا', 'Gotcha!'], ['bet you', 'betcha', 'بيتشا', 'I betcha he forgot.'], ['ought to', 'oughta', 'أوتا', 'You oughta try it.'],
  ['tell them', "tell 'em", 'تيلم', "Tell 'em I'm busy."], ['how are you doing', 'howya doin', 'هاوْيا دوين', 'Hey, howya doin?']
];

/* 43. Minimal pairs for sounds Arabic speakers often mix */
TJD.minimalPairs = [
  { id: 'pb', title: 'P و B', tip: 'P فيها نفَس قوي بدون اهتزاز الحبال الصوتية (حط يدك قدام فمك وحس بالهوا). B مثل الباء العربية.',
    pairs: [['pin', 'bin'], ['park', 'bark'], ['pear', 'bear'], ['pig', 'big'], ['pull', 'bull'], ['cap', 'cab'], ['rope', 'robe'], ['pie', 'buy'], ['pat', 'bat'], ['pack', 'back']] },
  { id: 'fv', title: 'F و V', tip: 'الاثنين أسنانك العليا على شفتك التحتية. F بدون صوت (مثل الفاء)، V مع اهتزاز (فاء مهتزة).',
    pairs: [['fan', 'van'], ['fine', 'vine'], ['fast', 'vast'], ['few', 'view'], ['ferry', 'very'], ['leaf', 'leave'], ['safe', 'save'], ['half', 'have'], ['fail', 'veil'], ['proof', 'prove']] },
  { id: 'ie', title: 'i و e', tip: 'i في sit قصيرة ومرتخية، e في set الفم مفتوح أكثر شوي.',
    pairs: [['sit', 'set'], ['bit', 'bet'], ['pin', 'pen'], ['did', 'dead'], ['tin', 'ten'], ['lid', 'led'], ['bill', 'bell'], ['wit', 'wet']] },
  { id: 'iee', title: 'i القصيرة وee الطويلة', tip: 'ee في sheep طويلة وشفايفك مشدودة كأنك تبتسم. i في ship قصيرة ومرتخية.',
    pairs: [['ship', 'sheep'], ['sit', 'seat'], ['live', 'leave'], ['fill', 'feel'], ['hit', 'heat'], ['bin', 'bean'], ['still', 'steal'], ['chip', 'cheap'], ['list', 'least']] },
  { id: 'chsh', title: 'CH و SH', tip: 'ch تبدأ بوقفة مثل «تش»، وsh صوت ممدود مثل «ش» بدون وقفة.',
    pairs: [['chip', 'ship'], ['chop', 'shop'], ['cheap', 'sheep'], ['chair', 'share'], ['watch', 'wash'], ['match', 'mash'], ['catch', 'cash'], ['chew', 'shoe']] },
  { id: 'ou', title: 'o وu', tip: 'o في coat مدورة وتنتهي بـ «و» خفيفة، وu في caught/cut أفتح.',
    pairs: [['cot', 'cut'], ['hot', 'hut'], ['shot', 'shut'], ['lock', 'luck'], ['boss', 'bus'], ['not', 'nut']] },
  { id: 'thz', title: 'TH وS/Z', tip: 'th طلّع طرف لسانك بين أسنانك (مثل الثاء والذال). لا تقولها s أو z أو t.',
    pairs: [['think', 'sink'], ['thick', 'sick'], ['thank', 'sank'], ['mouth', 'mouse'], ['then', 'zen'], ['breathe', 'breeze'], ['three', 'tree'], ['path', 'pass']] },
  { id: 'gj', title: 'G وJ', tip: 'g صوت «ق» المصرية/الخليجية (gate)، وj مثل الجيم الفصحى (jet).',
    pairs: [['gust', 'just'], ['got', 'jot'], ['gab', 'jab'], ['gain', 'Jane'], ['gay', 'Jay'], ['goes', 'Joe\'s']] }
];

/* 38/40. Sentences for pronunciation practice and shadowing, easy → harder */
TJD.practice = [
  'Nice to meet you.', 'How are you doing today?', 'Could you help me, please?', 'I would like a cup of coffee.', 'Where is the nearest station?',
  'What time does the store open?', 'I am looking for a pharmacy.', 'Can I pay by credit card?', 'Thank you very much for your help.', 'I think it is going to rain later.',
  'My brother works as an engineer.', 'We are planning a trip to London next month.', 'Could you speak a little more slowly?', 'I have been learning English for three years.',
  'The weather is beautiful this morning.', 'Three thin thieves thought a thousand thoughts.', 'She sells seashells by the seashore.', 'Peter picked a peck of pickled peppers.',
  'I prefer vegetables over fast food.', 'The meeting has been moved to Thursday afternoon.', 'Would you mind opening the window?', 'Very few people visited the village in February.',
  'I should have called you yesterday.', 'It is important to drink enough water every day.', 'The restaurant was so crowded that we had to wait.', 'Let me think about it and get back to you.',
  'Honestly, I did not expect the results to be this good.', 'Technology is changing the way we communicate with each other.', 'Could you please confirm my reservation for tonight?', 'Practice makes perfect.'
];
/* 42. Words Americans and Brits say differently: [word, US respelling, UK respelling, Arabic note] */
TJD.usuk = [
  ['tomato', 'tə-MAY-toh', 'tə-MAH-toh', 'الأمريكي «ماي»، البريطاني «ما»'], ['schedule', 'SKEJ-ool', 'SHED-yool', 'الأمريكي يبدأ بـ «سك»، البريطاني بـ «ش»'],
  ['water', 'WAH-der', 'WAW-tə', 'الأمريكي يقلب الـ t دال خفيفة ويلفظ الـ r'], ['either', 'EE-ther', 'EYE-ther', 'الاثنين صح بالبلدين، بس الشائع يختلف'],
  ['vitamin', 'VYE-tə-min', 'VIT-ə-min', 'الأمريكي «ڤاي»، البريطاني «ڤِ»'], ['can\'t', 'kant', 'kahnt', 'البريطاني يمد الألف «كاانت»'],
  ['dance', 'dans', 'dahns', 'نفس قاعدة can\'t: مد عند البريطاني'], ['garage', 'gə-RAHZH', 'GAR-ij', 'النبرة تختلف: آخر الكلمة بالأمريكي، أولها بالبريطاني'],
  ['route', 'rowt / root', 'root', 'الأمريكي كثير يقول «راوت»'], ['advertisement', 'ad-ver-TIZE-ment', 'ad-VER-tis-ment', 'مكان النبرة يختلف تمامًا'],
  ['privacy', 'PRY-və-see', 'PRIV-ə-see', 'الأمريكي «براي»، البريطاني «بريڤ»'], ['leisure', 'LEE-zher', 'LEZH-ə', ''],
  ['herb', 'erb', 'herb', 'الأمريكي ما ينطق الـ h'], ['data', 'DAY-tə / DA-də', 'DAY-tə', ''],
  ['adult', 'ə-DULT', 'AD-ult', 'النبرة تختلف'], ['mobile', 'MOH-bəl', 'MOH-byle', ''],
  ['better', 'BED-er', 'BET-ə', 'الـ t في النص تصير شبه «د» بالأمريكي'], ['car', 'kar', 'kah', 'البريطاني ما ينطق الـ r في آخر الكلمة'],
  ['hot', 'haht', 'hot', 'الـ o أفتح عند الأمريكي'], ['go', 'goh', 'gəʊ', 'البريطاني يبدأ الصوت بـ «ِ» خفيفة'],
  ['new', 'noo', 'nyoo', 'البريطاني يضيف «ي» بعد n و t و d'], ['tuesday', 'TOOZ-day', 'TYOOZ-day', '']
];
