# Wind Studio 3D

Interactive 3D experience where you control the wind by blowing into your microphone. Watch the character's dress and hair react in real time, and see her raise her hands to hold the hem when gusts get strong.

## Features

- **Microphone wind control** — blow into the mic to drive the simulation
- **Manual wind slider** — adjust strength without a mic
- **Demo gusts** — automatic wind cycle for demos
- **8 characters** with different outfits (long dress, summer dress, skirt & blouse, jacket & skirt, trousers)
- **7 locations**: Garden, Beach, Park, Rooftop, Outdoor Terrace, Forest, Modern Courtyard
- Real-time cloth + hair Verlet simulation
- Hands react to strong wind (character tries to hold her dress)
- Orbit camera (drag to rotate, scroll to zoom)

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

## Deploy (GitHub Pages)

The included GitHub Actions workflow builds and deploys to GitHub Pages on push to `main`.

1. Push this repo to GitHub
2. Settings → Pages → Source: GitHub Actions
3. After the workflow runs, the site will be live

## Project structure

```
src/
  App.tsx                 # Main UI + wind controls
  components/
    StylePanel.tsx        # Character & location picker
    WindMeter.tsx         # Wind level display
  lib/
    characters.ts         # Character presets
    locations.ts          # Location presets
    types.ts
    windEngine.ts         # Mic + demo wind engines
  three/
    character.ts          # Procedural adult female character
    cloth.ts              # Verlet cloth & hair
    dressSim.ts           # Dress + hair simulation + hand reaction
    environment.ts        # Locations / props
    windScene.ts          # Three.js scene orchestration
```

## Notes

- Character is procedural (Three.js geometry). For photorealistic GLB models you can place files under `public/assets/characters/` in a future upgrade.
- Best experience on a device with a working microphone and Chrome / Edge / Safari.
- Grant microphone permission when the browser asks.

## License

Personal / educational use. Do not use child or teen character models.
