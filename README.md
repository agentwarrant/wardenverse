# Wardenverse

A visual block explorer for Warden Protocol where transactions, blocks, proofs, and tokens are represented by pixel art stars, planets, comets, and interstellar explosions.

## Vision

Transform blockchain data into a living, breathing cosmic visualization inspired by the Noita videogame's pixel physics and visual style.

---

## 🚀 Quick Start for Local Testing

The dev server is configured for network access via Tailscale. Any code changes are automatically reflected with hot reload.

### Start Development Server

```bash
npm run dev
```

This starts the dev server accessible at:
- **Local:** http://localhost:3000/
- **Tailscale:** http://100.119.109.53:3000/
- **LAN:** http://192.168.3.19:3000/

### Production Build

For production testing, build and preview:

```bash
npm run build && npm run preview
```

### ⚡ Auto-Reload Workflow

When developing, always use `npm run dev` - it automatically:
- Rebuilds on file changes
- Hot-reloads the browser
- Keeps the Tailscale IP accessible

## Tech Stack

- **Frontend:** TypeScript + Vite
- **Rendering:** HTML5 Canvas with custom pixel rendering
- **Physics:** Custom pixel physics simulation (falling sand style)
- **Data Source:** Warden EVM RPC (`https://evm.wardenprotocol.org`)

## Visual Style (Noita-Inspired)

### Particle Types

The simulation includes 19 distinct pixel types, each with unique physics properties:

| Type | Behavior | Visual |
|------|----------|--------|
| **STAR** | Static, glowing | Bright golden points |
| **DUST** | Falls slowly, spreads | Subtle gray particles |
| **PLANET** | Static, large glow | Blue glowing bodies |
| **COMET** | Travels, leaves trail | Blue shooting stars |
| **EXPLOSION** | Rises rapidly, spreads | Bright orange bursts |
| **FIRE** | Rises, spreads to gas | Orange flames |
| **GAS** | Rises, dissipates | Purple vapor |
| **LIQUID** | Falls, spreads horizontally | Blue fluid |
| **ENERGY** | Short-lived, bright | Purple sparkles |
| **SPARK** | Falls slowly, ignites gas | White-yellow dots |
| **PLASMA** | Rises, spawns lightning | Purple-white energy |
| **ELECTRIC** | Very short-lived | Cyan flash |
| **LIGHTNING** | Creates branches | Bright white-blue |
| **EMBER** | Rises slowly, smoky | Orange-red particles |
| **SMOKE** | Rises, dissipates | Gray wisps |
| **DEBRIS** | Falls, spawns dust | Brown particles |
| **TOKEN** | Glows intensely, explodes | Bright green with sparkle |
| **VOID** | Absorbs nearby particles | Dark purple-black |

### Visual Features

- **Blocks** → Growing planets/stars with orbital rings and particle emissions
  - Size scales with transaction count
  - Activity level affects glow intensity
  - Birth explosions with plasma effects
  
- **Transactions** → Comets with enhanced trails
  - **Token transfers** → Bright green with intense sparkle, larger trails
  - **Contract calls** → Pink with plasma/lightning effects
  - **Regular transfers** → Blue with electric glow
  - **Proof of Inference** → Dramatic red fire/explosion effects, the largest and most intense comets
  
### Proof of Inference

**Proof of Inference** is Warden's onchain audit trail for AI Agents that links payments to user prompts and inferences.

When a user submits a prompt to an AI Agent on Warden, the protocol generates a hash of the prompt together with the hash of the returned inference, and stores both in an onchain proof. This creates a transparent, verifiable trail showing that a specific inference request was made and paid for.

Developers can generate the same hash offchain and match it against the onchain record, enabling:
- Verifiable AI inference audit trails
- Transparent payment tracking for AI services
- Trustless verification of prompt-response pairs

In Wardenverse, Proof of Inference transactions are visualized as dramatic red comets with fire trails and plasma explosions — the most visually striking transaction type, representing the computational energy of AI operations on the network.
  
- **Particle Physics**
  - Fire spreads to gas, creating explosions
  - Lightning branches between points
  - Particles interact realistically (falling sand style)
  
- **Interactive Effects**
  - Left-click: Create explosion
  - Right-click: Lightning bolt
  - Drag: Particle spray
  
- **Ambient Activity**
  - Continuous particle flow from edges
  - Stars twinkle and pulse
  - Background stays crowded and dynamic

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | How to Check | Install Link |
|-------------|---------|--------------|--------------|
| Node.js | 18.x or higher | `node --version` | https://nodejs.org/ |
| npm | 9.x or higher | `npm --version` | Comes with Node.js |
| Git | 2.x or higher | `git --version` | https://git-scm.com/ |

### Verify Prerequisites

```bash
# Check Node.js version (needs 18+)
node --version

# Check npm version
npm --version

# Check Git
git --version
```

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/luisvae/wardenverse.git
cd wardenverse
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `ethers` - For blockchain interaction
- `typescript` - For type checking
- `vite` - For development server and building

### Step 3: Verify Installation

```bash
# Check that TypeScript compiles without errors
npx tsc --noEmit
```

---

## Development

### Start the Development Server

```bash
npm run dev
```

This will:
1. Start the Vite development server on **port 3000**
2. Automatically open your browser to `http://localhost:3000`
3. Enable hot module replacement (HMR) for instant updates

### Development Server Options

If you need to change the default settings:

```bash
# Use a different port
npm run dev -- --port 3001

# Don't auto-open browser
npm run dev -- --no-open

# Expose to network (for testing on other devices)
npm run dev -- --host
```

### Development Workflow

1. **Edit source files** in the `src/` directory
2. **See changes instantly** in the browser (HMR)
3. **Check TypeScript errors** in your terminal or IDE
4. **Test blockchain connection** - The app connects to Warden EVM RPC automatically

---

## Building for Production

### Create a Production Build

```bash
npm run build
```

This will:
1. Compile TypeScript to JavaScript
2. Bundle all modules with Vite
3. Optimize and minify the output
4. Generate source maps for debugging
5. Output everything to the `dist/` folder

### Verify the Build

```bash
# Check that dist folder was created
ls -la dist/

# Expected output:
# dist/
# ├── main.js          # Bundled JavaScript
# ├── main.js.map      # Source map
# └── assets/          # Static assets (if any)
```

---

## Running Production Build

### Preview Locally

After building, you can preview the production build locally:

```bash
npm run preview
```

This serves the `dist/` folder on **port 4173** by default.

### Deploy to Static Hosting

The `dist/` folder contains everything needed for deployment. Upload it to any static hosting service:

| Platform | Instructions |
|----------|--------------|
| **GitHub Pages** | Push `dist/` contents to `gh-pages` branch |
| **Vercel** | `npx vercel --prod` or connect GitHub repo |
| **Netlify** | Drop `dist/` folder or connect GitHub repo |
| **AWS S3** | Upload `dist/` to S3 bucket with static hosting |
| **IPFS** | `npx ipfs-deploy dist` for decentralized hosting |

### Quick Deploy to GitHub Pages

```bash
# Install gh-pages if not already
npm install -D gh-pages

# Add to package.json scripts:
# "deploy": "gh-pages -d dist"

# Build and deploy
npm run build && npm run deploy
```

---

## Project Structure

```
wardenverse/
├── src/
│   ├── main.ts              # Application entry point
│   ├── core/
│   │   ├── Engine.ts        # Main rendering engine
│   │   ├── Pixel.ts         # Pixel abstraction
│   │   ├── PixelTypes.ts    # Pixel type definitions
│   │   ├── PixelWorld.ts    # World simulation
│   │   └── PhysicsWorker.ts # Web Worker for physics
│   ├── data/
│   │   └── BlockchainDataSource.ts  # Warden RPC integration
│   └── visuals/
│       ├── BlockVisual.ts         # Block visualization
│       └── TransactionVisual.ts   # Transaction visualization
├── public/                  # Static assets
├── dist/                    # Production build output
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite bundler configuration
└── README.md                # This file
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Dev Server** | `npm run dev` | Start development server with hot reload |
| **Build** | `npm run build` | Create optimized production build |
| **Preview** | `npm run preview` | Preview production build locally |
| **Lint** | `npm run lint` | Run ESLint on source files |

---

## Configuration

### Environment Variables

Create a `.env` file in the project root for custom configuration:

```env
# Optional: Custom RPC endpoint
VITE_WARDEN_RPC=https://evm.wardenprotocol.org

# Optional: Block explorer URL for links
VITE_EXPLORER_URL=https://explorer.wardenprotocol.org
```

### TypeScript Configuration

The project uses strict TypeScript settings. Key options in `tsconfig.json`:

- **Target:** ES2022 for modern browser features
- **Module:** ESNext for Vite compatibility
- **Strict mode:** Enabled for type safety

### Vite Configuration

Key settings in `vite.config.ts`:

- **Dev server port:** 3000
- **Auto-open browser:** Enabled
- **Build target:** ESNext
- **Sourcemaps:** Enabled

---

## Data Sources

| Data | Endpoint | Description |
|------|----------|-------------|
| **EVM RPC** | `https://evm.wardenprotocol.org` | JSON-RPC for blockchain data |
| **Block Explorer** | `https://explorer.wardenprotocol.org` | Human-readable transaction viewer |

---

## Troubleshooting

### Common Issues

#### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### TypeScript compilation errors

```bash
# Check for type errors
npx tsc --noEmit

# Ensure all dependencies are installed
npm install
```

#### Development server not starting

```bash
# Check if port 3000 is in use
lsof -i :3000

# Use a different port
npm run dev -- --port 3001
```

#### Build fails

```bash
# Clear dist folder and rebuild
rm -rf dist
npm run build
```

---

## Development Phases

1. **Phase 1:** Core rendering engine with pixel physics ✅
2. **Phase 2:** Blockchain data integration ✅
3. **Phase 3:** Visual representations for entities ✅
4. **Phase 4:** Interactive exploration UI 🚧
5. **Phase 5:** Performance optimization & polish 📋

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Links

- **GitHub:** https://github.com/luisvae/wardenverse
- **Warden Protocol:** https://wardenprotocol.org
- **Warden Docs:** https://docs.wardenprotocol.org
- **Block Explorer:** https://explorer.wardenprotocol.org