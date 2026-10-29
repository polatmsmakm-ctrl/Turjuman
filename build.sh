#!/bin/sh
# Builds Turjuman.ipa (ad-hoc signed; Sideloadly re-signs) with the keyboard and share extensions.
set -e
cd "$(dirname "$0")"
SDK=${SDK:-../sdks/iPhoneOS16.5.sdk}
APP=out/Payload/Turjuman.app
CFLAGS="-target arm64-apple-ios15.0 -isysroot $SDK -fobjc-arc -O2 -Wall -Wextra -Wno-unused-parameter -Wno-deprecated-declarations"
if [ "$(uname)" = "Darwin" ]; then LD="-Wl,-dead_strip"; else LD="-fuse-ld=lld -Wl,-adhoc_codesign -Wl,-dead_strip"; fi
rm -rf out/Payload out/Turjuman.ipa
mkdir -p "$APP"
clang $CFLAGS $LD \
  -framework UIKit -framework WebKit -framework Speech -framework AVFoundation -framework QuartzCore -framework CoreGraphics \
  -framework Foundation -framework Vision -framework PDFKit -framework PhotosUI -framework UniformTypeIdentifiers \
  -framework UserNotifications -framework CoreMedia -framework CoreVideo \
  src/main.m src/speech.m src/media.m -o "$APP/Turjuman"
cp Info.plist "$APP/Info.plist"
printf 'APPL????' > "$APP/PkgInfo"
cp res/AppIcon*.png "$APP/"
# web UI
mkdir -p "$APP/web"
(cd web && find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.ttf' -o -name '*.txt' -o -name '*.json' \) | while read f; do mkdir -p "../$APP/web/$(dirname "$f")"; cp "$f" "../$APP/web/$f"; done)
# keyboard extension
EXT="$APP/PlugIns/TurjumanKeyboard.appex"
mkdir -p "$EXT"
clang $CFLAGS -fapplication-extension $LD -Wl,-application_extension -Wl,-e,_NSExtensionMain \
  -framework UIKit -framework QuartzCore -framework CoreGraphics -framework Foundation \
  src/keyboard.m -o "$EXT/TurjumanKeyboard"
cp Keyboard-Info.plist "$EXT/Info.plist"
# share extension
SHX="$APP/PlugIns/TurjumanShare.appex"
mkdir -p "$SHX"
clang $CFLAGS -fapplication-extension $LD -Wl,-application_extension -Wl,-e,_NSExtensionMain \
  -framework UIKit -framework Foundation -framework Vision -framework UniformTypeIdentifiers -framework CoreGraphics \
  src/share.m -o "$SHX/TurjumanShare"
cp Share-Info.plist "$SHX/Info.plist"
# widget extension (needs Swift: only builds on a Mac / GitHub Actions macOS runner)
if [ "$(uname)" = "Darwin" ] && command -v xcrun >/dev/null 2>&1 && [ -f widget/TurjumanWidget.swift ]; then
  WGX="$APP/PlugIns/TurjumanWidget.appex"
  mkdir -p "$WGX"
  xcrun --sdk iphoneos swiftc -target arm64-apple-ios16.0 -sdk "$SDK" -O -parse-as-library -application-extension \
    -module-name TurjumanWidget -framework WidgetKit -framework SwiftUI \
    -Xlinker -e -Xlinker _NSExtensionMain -Xlinker -application_extension \
    widget/TurjumanWidget.swift -o "$WGX/TurjumanWidget"
  cp widget/Widget-Info.plist "$WGX/Info.plist"
  cp widget/words.json "$WGX/words.json"
  python3 -c "import plistlib,sys; plistlib.load(open(sys.argv[1],'rb'))" "$WGX/Info.plist"
  codesign -s - --force "$WGX" 2>/dev/null || true
else
  echo "widget: skipped (needs macOS + Swift)"
fi
for p in "$APP/Info.plist" "$EXT/Info.plist" "$SHX/Info.plist"; do python3 -c "import plistlib,sys; plistlib.load(open(sys.argv[1],'rb'))" "$p"; done
(cd out && zip -qr -X Turjuman.ipa Payload)
ls -la out/Turjuman.ipa
