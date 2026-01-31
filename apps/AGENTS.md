# apps/ — Native Companion Apps

Multi-platform native apps (Swift + Kotlin). All connect to the Gateway via WebSocket.

## Structure

```
apps/
├── macos/                  # macOS menu bar app (Swift, ~187 files)
│   ├── Sources/Moltbot/    # App source
│   └── Tests/              # XCTest + IPC tests
├── ios/                    # iOS node app (Swift)
│   ├── Sources/            # App source
│   ├── Tests/              # Tests
│   └── fastlane/           # iOS build automation
├── android/                # Android node app (Kotlin)
│   └── app/                # Gradle module
└── shared/
    └── MoltbotKit/         # Shared Swift package (macOS + iOS)
        └── Sources/MoltbotKit/  # Gateway protocol client, models, utilities
```

## Key Patterns

### Gateway Connection
All apps connect via WebSocket to `ws://127.0.0.1:18789` (or remote via Tailscale/SSH tunnel).
Shared protocol client lives in `MoltbotKit/Sources/MoltbotKit/`.

### Protocol Codegen
TypeScript protocol schemas generate Swift types:
- Run: `pnpm protocol:gen:swift`
- Source: `scripts/protocol-gen-swift.ts`
- Output goes into MoltbotKit
- **Always regenerate after protocol changes**

### SwiftUI State Management
Prefer `Observation` framework (`@Observable`, `@Bindable`) over `ObservableObject`/`@StateObject`.
Migrate existing `ObservableObject` usages when touching related code.

### Build Commands

| Platform | Build | Notes |
|----------|-------|-------|
| **macOS** | `scripts/package-mac-app.sh` | Multi-arch (arm64/x86_64/universal), Sparkle updates |
| **macOS sign** | `scripts/codesign-mac-app.sh` | Code signing |
| **macOS notarize** | `scripts/notarize-mac-artifact.sh` | Apple notarization |
| **iOS** | Xcode / `fastlane` | See `apps/ios/fastlane/` |
| **Android** | Gradle | `apps/android/app/build.gradle.kts` |

### Version Locations
- macOS: `apps/macos/Sources/Moltbot/Resources/Info.plist` (CFBundleShortVersionString/CFBundleVersion)
- iOS: `apps/ios/Sources/Info.plist` + `apps/ios/Tests/Info.plist`
- Android: `apps/android/app/build.gradle.kts` (versionName/versionCode)
- **Do not change versions without explicit operator consent.**

## Swift Conventions

- **Linting**: SwiftLint (`.swiftlint.yml`) — line length 120w/250e, high complexity tolerance (20w/120e)
- **Formatting**: SwiftFormat (`.swiftformat`) — Swift 6.2, 4-space indent, 120 char width, explicit `self`
- **Target**: Swift 6.2, Xcode 26.1

## Anti-Patterns

- **Never rebuild macOS app over SSH** — must be done directly on the Mac.
- **"Restart app" = rebuild + relaunch**, not just kill/launch.
- **Check real devices first** before reaching for simulators/emulators.
- **Don't introduce new `ObservableObject`** — use `@Observable` instead.
- **Don't edit MoltbotKit types directly** if they come from protocol codegen.
