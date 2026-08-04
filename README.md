# Bass Voicing Mapper

An interactive 4-string bass fretboard for visualizing chord tones, finding compact voicings, and practising progressions in time.

## Features

- chord parsing with sharps, flats, triads, sixths, sevenths, ninths, altered
  dominants, suspensions and slash-chord bass notes
- strict validation: unknown symbols are reported, never guessed
- degree-aware note spelling (F7 shows E♭, not D♯)
- optimized voicings inside a selectable fret range, chosen by dynamic
  programming for minimum movement between chords
- chords with no voicing in range are flagged instead of voiding the whole path
- timed chord, arpeggio, and walking-bass practice modes
- built-in metronome, adjustable tempo, and A–B loop
- optional local backing track with playback speed control
- saved songs in browser storage
- four pages: instrument, repertoire, saved songs, and a help page
- 20 song and practice progressions
- English and Italian interface (English by default)
- responsive layout for desktop and mobile

Everything runs client-side; nothing is uploaded.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The static production files are generated in `dist/`.

## Test

```bash
npm test
```

The music-engine tests cover chord aliases, invalid input, harmonic omission
priorities, slash bass notes, enharmonic spelling, and the default progression.

## Deploy to Cloudflare Workers

1. Connect this GitHub repository in Cloudflare Workers & Pages.
2. Use `npm run build` as the build command.
3. Use `npx wrangler deploy` as the deploy command.
4. Add the custom domain `bass-voicing-mapper.massimodanieli.com` to the Worker.

You can also deploy from a configured terminal with:

```bash
npm run deploy
```

## Music notation

The progression parser accepts forms such as:

- `G A D`
- `C-7 F7 Bbdim7 Ebdim7`
- `Am7 Dm7 G7 Cmaj7`
- `C/E D/F# G`

Built for standard E–A–D–G four-string bass.
