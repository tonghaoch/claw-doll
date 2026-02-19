# claw-doll

A pixel-art **web claw machine** game (not a real physics simulation). Your goal is to catch dolls and **complete the Pokédex/collection**.

Built with **Phaser 3** + **TypeScript** and bundled by **Vite**.

## Gameplay

- Move the claw, drop it, and try to grab dolls.
- Progress is stored locally (browser storage) so you can continue later.

## Controls

- **Left / Right**: move the claw
- **Space**: drop the claw
- **P**: open Pokédex / collection
- **Esc**: close Pokédex
- **R**: reset local save data

## Development

Requirements: Node.js + npm

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build & Preview

```bash
npm run build
npm run preview
```

> Note: Vite may warn about large chunks after minification. This project is small enough for now; if it becomes a problem, we can introduce code-splitting (dynamic `import()` / Rollup `manualChunks`).

## Project Notes

- This game is intentionally **arcade-like**: the claw behavior is tuned for feel, not physical accuracy.
- Reference screenshots used during visual polish are stored in `docs/refs/`.

## License

See `LICENSES/`.
