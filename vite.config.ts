import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Set here rather than with a per-file docblock: the annotation resolved
    // inconsistently across machines, leaving window defined but localStorage
    // missing. An explicit origin is required for localStorage and pushState.
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/" } },
  },
});
