import { describe, expect, it } from "vitest";

import { splitMediaFromOutput } from "./parse.js";

describe("splitMediaFromOutput", () => {
  it("detects audio_as_voice tag and strips it", () => {
    const result = splitMediaFromOutput("Hello [[audio_as_voice]] world");
    expect(result.audioAsVoice).toBe(true);
    expect(result.text).toBe("Hello world");
  });

  it("accepts absolute media paths with spaces via fallback", () => {
    const result = splitMediaFromOutput("MEDIA:/Users/pete/My File.png");
    expect(result.mediaUrls).toEqual(["/Users/pete/My File.png"]);
    expect(result.text).toBe("");
  });

  it("accepts quoted absolute media paths with spaces", () => {
    const result = splitMediaFromOutput('MEDIA:"/Users/pete/My File.png"');
    expect(result.mediaUrls).toEqual(["/Users/pete/My File.png"]);
    expect(result.text).toBe("");
  });

  it("accepts absolute media paths without spaces", () => {
    const result = splitMediaFromOutput("MEDIA:/tmp/tts-xxx/voice.mp3");
    expect(result.mediaUrls).toEqual(["/tmp/tts-xxx/voice.mp3"]);
    expect(result.text).toBe("");
  });

  it("rejects absolute paths with directory traversal", () => {
    const result = splitMediaFromOutput("MEDIA:/tmp/../etc/passwd");
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe("MEDIA:/tmp/../etc/passwd");
  });

  it("accepts file:// URI absolute paths", () => {
    const result = splitMediaFromOutput("MEDIA:file:///tmp/voice.mp3");
    expect(result.mediaUrls).toEqual(["/tmp/voice.mp3"]);
    expect(result.text).toBe("");
  });

  it("rejects file:// URI with traversal", () => {
    const result = splitMediaFromOutput("MEDIA:file:///tmp/../etc/passwd");
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe("MEDIA:file:///tmp/../etc/passwd");
  });

  it("rejects tilde media paths to prevent LFI", () => {
    const result = splitMediaFromOutput("MEDIA:~/Pictures/My File.png");
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe("MEDIA:~/Pictures/My File.png");
  });

  it("rejects directory traversal media paths to prevent LFI", () => {
    const result = splitMediaFromOutput("MEDIA:../../etc/passwd");
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe("MEDIA:../../etc/passwd");
  });

  it("captures safe relative media paths", () => {
    const result = splitMediaFromOutput("MEDIA:./screenshots/image.png");
    expect(result.mediaUrls).toEqual(["./screenshots/image.png"]);
    expect(result.text).toBe("");
  });

  it("keeps audio_as_voice detection stable across calls", () => {
    const input = "Hello [[audio_as_voice]]";
    const first = splitMediaFromOutput(input);
    const second = splitMediaFromOutput(input);
    expect(first.audioAsVoice).toBe(true);
    expect(second.audioAsVoice).toBe(true);
  });

  it("keeps MEDIA mentions in prose", () => {
    const input = "The MEDIA: tag fails to deliver";
    const result = splitMediaFromOutput(input);
    expect(result.mediaUrls).toBeUndefined();
    expect(result.text).toBe(input);
  });

  it("parses MEDIA tags with leading whitespace", () => {
    const result = splitMediaFromOutput("  MEDIA:./screenshot.png");
    expect(result.mediaUrls).toEqual(["./screenshot.png"]);
    expect(result.text).toBe("");
  });
});
