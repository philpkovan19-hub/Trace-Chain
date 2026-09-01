const hre = require("hardhat");

async function main() {
  console.log("Deploying BOTSupplyChain to", hre.network.name, "...");
  console.log("=".repeat(60));

  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error("\n❌ No signer available.");
    console.error("Check that .env exists in this folder and contains:");
    console.error("   PRIVATE_KEY=0xYourRealPrivateKey (64 hex chars after 0x)\n");
    process.exit(1);
  }
  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress();

  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  console.log("Deployer:", deployerAddress);
  console.log("Balance:", hre.ethers.formatEther(balance), "BOT");

  if (balance === 0n) {
    console.error("\n❌ Deployer has 0 BOT. Get testnet BOT from https://faucet.botchain.ai first.\n");
    process.exit(1);
  }

  const Factory = await hre.ethers.getContractFactory("BOTSupplyChain");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("=".repeat(60));
  console.log("✅ BOTSupplyChain deployed to:", address);
  console.log("\nNext steps:");
  console.log("1. Paste this address into frontend/index.html -> CONTRACT_ADDRESS");
  console.log("2. For mainnet, also switch chainId/RPC/explorer in the same file");
}

main().catch((e) => { console.error(e); process.exit(1); });
