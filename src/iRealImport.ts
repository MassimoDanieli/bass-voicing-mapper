export type IRealSong = {
  title: string;
  artist: string;
  style: string;
  key: string;
  progression: string;
};

function normalizeChord(token: string) {
  let value = token.trim();
  if (!value || value === "N.C." || value === "n" || value === "x") return "";
  value = value
    .replace(/\^/g, "maj")
    .replace(/-/g, "m")
    .replace(/h/g, "m7b5")
    .replace(/o/g, "dim")
    .replace(/\*/g, "")
    .replace(/\(([^)]*)\)/g, "$1")
    .replace(/\s+/g, "");
  return value;
}

function decodePayload(value: string) {
  const raw = value.replace(/^ireal(?:book|b):\/\//i, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function progressionFromChart(chart: string) {
  const cleaned = chart
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[|,:]/g, " ")
    .replace(/[A-Z]\*?/g, match => (/^[A-G]/.test(match) ? match : " "));

  const tokens = cleaned
    .split(/\s+/)
    .map(token => token.replace(/^[()]+|[()]+$/g, ""))
    .map(normalizeChord)
    .filter(Boolean)
    .filter(token => /^[A-G](?:#|b)?/.test(token));

  return tokens.join(" ");
}

export function parseIRealInput(input: string): IRealSong[] {
  const decoded = decodePayload(input.trim());
  const chunks = decoded.includes("===") ? decoded.split("===") : [decoded];
  const songs: IRealSong[] = [];

  for (const chunk of chunks) {
    const parts = chunk.split("=");
    if (parts.length < 6) continue;
    const [title = "Brano iReal", artist = "", style = "", key = "", ...rest] = parts;
    const chart = rest.join("=");
    const progression = progressionFromChart(chart);
    if (!progression) continue;
    songs.push({
      title: title.trim() || "Brano iReal",
      artist: artist.trim(),
      style: style.trim(),
      key: key.trim(),
      progression,
    });
  }

  if (!songs.length && decoded.trim()) {
    const progression = progressionFromChart(decoded);
    if (progression) songs.push({ title: "Import iReal", artist: "", style: "", key: "", progression });
  }

  return songs;
}
