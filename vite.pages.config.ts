import { defineConfig } from "vite";

const pagesBase = "/mingchao-interactive-h5";

export default defineConfig({
  root: "github-pages",
  publicDir: "../public",
  base: `${pagesBase}/`,
  plugins: [
    {
      name: "github-pages-public-assets",
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type === "chunk") {
            output.code = output.code.replaceAll("/assets/", `${pagesBase}/assets/`);
          }
        }
      },
    },
  ],
  build: {
    outDir: "../pages-dist",
    emptyOutDir: true,
  },
});
