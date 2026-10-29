import WidgetKit
import SwiftUI

// MARK: - Data (bundled word list; no App Group needed, so it works with a free Apple ID)

struct Word: Codable {
    let w: String
    let ipa: String
    let ar: String
    let ex: String
}

enum WordStore {
    static let words: [Word] = {
        if let u = Bundle.main.url(forResource: "words", withExtension: "json"),
           let d = try? Data(contentsOf: u),
           let a = try? JSONDecoder().decode([Word].self, from: d), !a.isEmpty {
            return a
        }
        return [Word(w: "hello", ipa: "həˈloʊ", ar: "مرحبا", ex: "Hello!")]
    }()

    static func word(for date: Date) -> Word {
        let day = Calendar.current.ordinality(of: .day, in: .era, for: date) ?? 0
        return words[day % words.count]
    }
}

func dictURL(_ w: String) -> URL {
    var c = URLComponents()
    c.scheme = "turjuman"
    c.host = "dict"
    c.queryItems = [URLQueryItem(name: "q", value: w)]
    return c.url ?? URL(string: "turjuman://dict")!
}

// MARK: - Style

extension Color {
    static let tjTeal = Color(red: 0.05, green: 0.42, blue: 0.40)
    static let tjDeep = Color(red: 0.03, green: 0.22, blue: 0.24)
}

extension View {
    @ViewBuilder
    func tjBackground() -> some View {
        let g = LinearGradient(colors: [.tjTeal, .tjDeep], startPoint: .topLeading, endPoint: .bottomTrailing)
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(g, for: .widget)
        } else {
            self.background(g)
        }
    }

    @ViewBuilder
    func tjAccessoryBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(.clear, for: .widget)
        } else {
            self
        }
    }
}

// MARK: - Word of the day

struct WordEntry: TimelineEntry {
    let date: Date
    let word: Word
}

struct WordProvider: TimelineProvider {
    func placeholder(in context: Context) -> WordEntry { WordEntry(date: Date(), word: WordStore.words[0]) }

    func getSnapshot(in context: Context, completion: @escaping (WordEntry) -> Void) {
        completion(WordEntry(date: Date(), word: WordStore.word(for: Date())))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WordEntry>) -> Void) {
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        var entries: [WordEntry] = []
        for i in 0..<7 {
            if let d = cal.date(byAdding: .day, value: i, to: start) {
                entries.append(WordEntry(date: d, word: WordStore.word(for: d)))
            }
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct WordView: View {
    @Environment(\.widgetFamily) var family
    let entry: WordEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("\(entry.word.w) · \(entry.word.ar)")
                .widgetURL(dictURL(entry.word.w))
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.word.w).font(.headline).bold()
                Text(entry.word.ar).font(.caption).lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .tjAccessoryBackground()
            .widgetURL(dictURL(entry.word.w))
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Text(entry.word.w).font(.system(size: 12, weight: .bold)).minimumScaleFactor(0.5).lineLimit(1).padding(4)
            }
            .tjAccessoryBackground()
            .widgetURL(dictURL(entry.word.w))
        case .systemSmall:
            VStack(alignment: .leading, spacing: 4) {
                Text("كلمة اليوم").font(.caption2).foregroundColor(.white.opacity(0.7))
                Text(entry.word.w).font(.system(size: 22, weight: .bold)).foregroundColor(.white).minimumScaleFactor(0.6).lineLimit(1)
                Text("/\(entry.word.ipa)/").font(.caption2).foregroundColor(.white.opacity(0.75)).lineLimit(1)
                Spacer(minLength: 2)
                Text(entry.word.ar).font(.system(size: 15, weight: .semibold)).foregroundColor(.white).lineLimit(3).multilineTextAlignment(.trailing)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .tjBackground()
            .widgetURL(dictURL(entry.word.w))
        default:
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("كلمة اليوم").font(.caption).foregroundColor(.white.opacity(0.7))
                    Spacer()
                    Text("ترجمان").font(.caption).bold().foregroundColor(.white.opacity(0.7))
                }
                HStack(alignment: .firstTextBaseline) {
                    Text(entry.word.w).font(.system(size: 30, weight: .bold)).foregroundColor(.white).minimumScaleFactor(0.6).lineLimit(1)
                    Text("/\(entry.word.ipa)/").font(.footnote).foregroundColor(.white.opacity(0.8)).lineLimit(1)
                }
                Text(entry.word.ar).font(.system(size: 20, weight: .semibold)).foregroundColor(.white)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                Text(entry.word.ex).font(.footnote).italic().foregroundColor(.white.opacity(0.85)).lineLimit(2)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .tjBackground()
            .widgetURL(dictURL(entry.word.w))
        }
    }
}

struct WordWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TurjumanWord", provider: WordProvider()) { entry in
            WordView(entry: entry)
        }
        .configurationDisplayName("كلمة اليوم")
        .description("كلمة إنجليزية جديدة كل يوم مع نطقها ومعناها.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

// MARK: - Quick actions

struct ActionEntry: TimelineEntry { let date: Date }

struct ActionProvider: TimelineProvider {
    func placeholder(in context: Context) -> ActionEntry { ActionEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (ActionEntry) -> Void) { completion(ActionEntry(date: Date())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ActionEntry>) -> Void) {
        completion(Timeline(entries: [ActionEntry(date: Date())], policy: .never))
    }
}

struct QuickAction: Identifiable {
    let id: String
    let title: String
    let symbol: String
    let url: String
}

let quickActions: [QuickAction] = [
    QuickAction(id: "auto", title: "تكلّم", symbol: "mic.fill", url: "turjuman://auto"),
    QuickAction(id: "clip", title: "المنسوخ", symbol: "doc.on.clipboard", url: "turjuman://clipboard"),
    QuickAction(id: "cam", title: "كاميرا", symbol: "camera.fill", url: "turjuman://camera"),
    QuickAction(id: "dict", title: "القاموس", symbol: "character.book.closed.fill", url: "turjuman://dict")
]

struct ActionButton: View {
    let a: QuickAction
    var body: some View {
        Link(destination: URL(string: a.url)!) {
            VStack(spacing: 6) {
                Image(systemName: a.symbol).font(.system(size: 22, weight: .semibold))
                Text(a.title).font(.caption).bold()
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.white.opacity(0.16))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

struct ActionView: View {
    @Environment(\.widgetFamily) var family
    let entry: ActionEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "mic.fill").font(.system(size: 20, weight: .semibold))
            }
            .tjAccessoryBackground()
            .widgetURL(URL(string: "turjuman://auto")!)
        case .systemSmall:
            VStack(spacing: 8) {
                Image(systemName: "mic.fill").font(.system(size: 34, weight: .semibold))
                Text("تكلّم وترجم").font(.subheadline).bold()
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .tjBackground()
            .widgetURL(URL(string: "turjuman://auto")!)
        default:
            HStack(spacing: 8) {
                ForEach(quickActions) { ActionButton(a: $0) }
            }
            .tjBackground()
        }
    }
}

struct ActionWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TurjumanActions", provider: ActionProvider()) { entry in
            ActionView(entry: entry)
        }
        .configurationDisplayName("اختصارات الترجمة")
        .description("افتح الميكروفون أو الكاميرا أو ترجمة المنسوخ بضغطة من الشاشة الرئيسية.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    }
}

@main
struct TurjumanWidgets: WidgetBundle {
    var body: some Widget {
        WordWidget()
        ActionWidget()
    }
}
