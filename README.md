# Wardenverse

A visual block explorer for Warden Protocol where transactions, blocks, proofs, and tokens are represented by pixel art stars, planets, comets, and interstellar explosions.

## Vision

Transform blockchain data into a living, breathing cosmic visualization inspired by the Noita videogame's pixel physics and visual style.

## Tech Stack

- **Frontend:** TypeScript + React (or vanilla JS with Canvas)
- **Rendering:** HTML5 Canvas with custom pixel rendering
- **Physics:** Custom pixel physics simulation (falling sand style)
- **Data Source:** Warden EVM RPC (`https://evm.wardenprotocol.org`)

## Visual Style (Noita-Inspired)

- Every blockchain entity is represented as pixel art:
  - **Blocks** → Planets/stars that grow with transaction volume
  - **Transactions** → Comets/shooting stars traveling between blocks
  - **Token transfers** → Particle streams with color based on token type
  - **Smart contract calls** → Interstellar explosions
- Physics simulation: particles interact realistically
  - Fire spreads, liquids flow, gases dissipate
  - Creates emergent visual patterns
- Fog of war: unexplored blockchain areas are hidden
- Atmospheric lighting: blocks with high activity glow brighter

## Architecture

```
wardenverse/
├── src/
│   ├── core/           # Core rendering & physics engine
│   ├── data/           # Blockchain data fetching & caching
│   ├── visuals/        # Visual representations & effects
│   ├── ui/             # User interface components
│   └── main.ts         # Entry point
├── public/
│   └── index.html
├── package.json
└── README.md
```

## Data Sources

- **EVM RPC:** `https://evm.wardenprotocol.org`
- **Block Explorer:** `https://explorer.wardenprotocol.org`

## Getting Started

```bash
npm install
npm run dev
```

## Development Phases

1. **Phase 1:** Core rendering engine with pixel physics
2. **Phase 2:** Blockchain data integration
3. **Phase 3:** Visual representations for entities
4. **Phase 4:** Interactive exploration UI
5. **Phase 5:** Performance optimization & polish