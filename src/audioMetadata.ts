export type AudioMetadata = {
  title?: string;
  artist?: string;
  album?: string;
};

function decodeText(bytes: Uint8Array, encoding: number) {
  const data = bytes[0] === encoding ? bytes.slice(1) : bytes;
  if (encoding === 1 || encoding === 2) {
    try {
      return new TextDecoder("utf-16").decode(data).replace(/\0/g, "").trim();
    } catch {
      return "";
    }
  }
  try {
    return new TextDecoder(encoding === 3 ? "utf-8" : "iso-8859-1").decode(data).replace(/\0/g, "").trim();
  } catch {
    return new TextDecoder().decode(data).replace(/\0/g, "").trim();
  }
}

function synchsafe(bytes: Uint8Array) {
  return ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f);
}

function uint32(bytes: Uint8Array) {
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

function fallbackFromFilename(fileName: string): AudioMetadata {
  const clean = fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
  const parts = clean.split(/\s+-\s+/);
  if (parts.length >= 2) return { artist: parts.shift()?.trim(), title: parts.join(" - ").trim() };
  return { title: clean };
}

export async function readAudioMetadata(file: File): Promise<AudioMetadata> {
  const fallback = fallbackFromFilename(file.name);
  if (!/\.mp3$/i.test(file.name) && file.type !== "audio/mpeg") return fallback;

  const head = new Uint8Array(await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer());
  if (head.length < 10 || String.fromCharCode(...head.slice(0, 3)) !== "ID3") return fallback;

  const version = head[3];
  const tagSize = synchsafe(head.slice(6, 10));
  let offset = 10;
  const end = Math.min(head.length, 10 + tagSize);
  const result: AudioMetadata = { ...fallback };

  while (offset + 10 <= end) {
    const id = String.fromCharCode(...head.slice(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = version === 4 ? synchsafe(head.slice(offset + 4, offset + 8)) : uint32(head.slice(offset + 4, offset + 8));
    if (!size || offset + 10 + size > end) break;
    const frame = head.slice(offset + 10, offset + 10 + size);
    const text = frame.length ? decodeText(frame, frame[0]) : "";
    if (id === "TIT2" && text) result.title = text;
    if (id === "TPE1" && text) result.artist = text;
    if (id === "TALB" && text) result.album = text;
    offset += 10 + size;
  }

  return result;
}
