# TraceChain

**TraceChain** is a supply chain tracking DApp built on **BOT Chain**. It lets anyone register a product on-chain and follow it through its journey — from origin to final delivery — with a tamper-proof, timestamped history of every stage it passes through.

## How it works

- **Anyone** can create a product by calling `createProduct(name, origin, initialStage, location)`. This is free (aside from gas) and immediately records the first stage in the product's history.
- **Only the address that created a product** can advance it with `addStage(productId, stageName, location, handler, notes)`. This keeps the chain of custody honest — a competitor or bystander can't tamper with someone else's product record.
- Every product tracks its `id`, `name`, `origin`, `creator`, `currentStage`, `createdAt` timestamp, and a running count of stages. The full stage-by-stage history (name, location, handler, timestamp, notes) is stored separately and can be pulled with `getStages(id)`.
- The contract owner can `pause()` / `unpause()` the contract in an emergency, halting new products and stage updates without affecting existing on-chain data.

## Contract

`contracts/BOTSupplyChain.sol` — Solidity 0.8.20, built on OpenZeppelin's `Ownable`, `ReentrancyGuard`, and `Pausable`.

Key read functions:
- `getProduct(id)` — core product details
- `getStages(id)` — full stage history
- `getProductsByCreator(address)` — all product ids created by an address
- `getRecent(count)` — the most recently created product ids

## Project layout

```
tracechain/
├── contracts/BOTSupplyChain.sol   # the contract
├── scripts/deploy.js              # deployment script
├── test/BOTSupplyChain.test.js    # test suite
├── frontend/index.html            # single-file cyberpunk HUD frontend
├── hardhat.config.js
├── package.json
└── vercel.json                    # deploys frontend/ as a static site
```

## Setup

```bash
npm install
cp .env.example .env   # then fill in PRIVATE_KEY
```

## Compile & test

```bash
npm run compile
npm test
```

## Deploy

TraceChain targets **BOT Chain**:

- Testnet (chainId `968`, RPC `https://rpc.bohr.life`):
  ```bash
  npm run deploy:testnet
  ```
- Mainnet (chainId `677`, RPC `https://rpc.botchain.ai`):
  ```bash
  npm run deploy:mainnet
  ```

Fund your deployer address with testnet BOT from https://faucet.botchain.ai before deploying to testnet.

After deployment, paste the printed contract address into `CONTRACT_ADDRESS` near the top of `frontend/index.html`.

## Frontend

`frontend/index.html` is a single self-contained file (no build step) with a cyberpunk neon HUD look. It connects to MetaMask, auto-prompts a switch/add to the BOT Chain testnet, and lets you:

- Create a product
- Add a stage to a product you created
- Track any product by id, with its stage history rendered as a timeline
- Browse recently created products

Deploy it as-is to Vercel (see `vercel.json`), or open it directly in a browser with MetaMask installed.
