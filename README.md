# Wind Studio 3D

Blow into your phone's microphone and watch an adult character's hair, dupatta /
scarf and clothes flow in the wind. Everything is full-coverage clothing
(long sleeves, ankle-length dresses, kameez shalwar, long coat, or trousers with a
long tunic). The wind only makes fabric and hair move: skirts are capped so they
cannot ride up, and nothing in the app is designed to reveal anything.

## Run

    npm install
    npm run dev          # local
    npm run build        # production build in dist/

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.
The app is a PWA: open it in Chrome on Android and choose "Install app".

## Characters and places

- Characters: `src/lib/characters.ts` (colours, outfit style, length). All are adult women.
- Places: `src/lib/locations.ts` (garden, beach, park, rooftop, terrace, forest, courtyard).
- Wind, hair, dupatta and cloth physics: `src/three/dressSim.ts` and `src/three/cloth.ts`.

## Optional realistic models

You can drop adult female GLB models (CC0 / licensed, in everyday full-coverage
clothing) into `public/assets/characters/<id>.glb`. Loading them is not wired in yet;
the built-in procedural character is used.
