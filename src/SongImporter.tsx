import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { analyzeAudioFile, type AudioAnalysis } from "./audioAnalysis";
import "./SongImporter.css";

type SongSource = "audio" | "youtube";
type Song = {
  id: string;
  source: SongSource;
  title: string;
  artist: string;
  progression: string;
  bpm: number;
  key?: string;
  confidence?: number;
  youtubeId?: string;
  file