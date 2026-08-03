import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SongImporter from "./SongImporter";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <SongImporter />
  </StrictMode>,
);
