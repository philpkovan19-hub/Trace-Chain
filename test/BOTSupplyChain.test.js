const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const Stage = { Created: 0, InTransit: 1, Delivered: 2 };

describe("BOTSupplyChain", function () {
  let contract;
  let owner, manufacturer1, manufacturer2, handler, other;

  beforeEach(async function () {
    [owner, manufacturer1, manufacturer2, handler, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("BOTSupplyChain");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  describe("Creation", function () {
    it("creates a product and increments getProductCount", async function () {
      await contract
        .connect(manufacturer1)
        .createProduct("Coffee Beans", "Arabica beans", "Colombia");
      expect(await contract.getProductCount()).to.equal(1n);
    });

    it("stores correct product fields", async function () {
      await contract
        .connect(manufacturer1)
        .createProduct("Coffee Beans", "Arabica beans", "Colombia");
      const product = await contract.getProduct(1);
      expect(product.id).to.equal(1n);
      expect(product.name).to.equal("Coffee Beans");
      expect(product.description).to.equal("Arabica beans");
      expect(product.origin).to.equal("Colombia");
      expect(product.manufacturer).to.equal(await manufacturer1.getAddress());
      expect(product.currentStage).to.equal(Stage.Created);
    });

    it("emits ProductCreated with expected args", async function () {
      await expect(
        contract
          .connect(manufacturer1)
          .createProduct("Coffee Beans", "Arabica beans", "Colombia")
      )
        .to.emit(contract, "ProductCreated")
        .withArgs(1n, await manufacturer1.getAddress(), "Coffee Beans");
    });

    it("reverts when name is empty", async function () {
      await expect(
        contract.connect(manufacturer1).createProduct("", "desc", "Colombia")
      ).to.be.revertedWith("Name required");
    });

    it("records an initial Created checkpoint", async function () {
      await contract
        .connect(manufacturer1)
        .createProduct("Coffee Beans", "Arabica beans", "Colombia");
      const cps = await contract.getCheckpoints(1);
      expect(cps.length).to.equal(1);
      expect(cps[0].stage).to.equal(Stage.Created);
      expect(cps[0].handler).to.equal(await manufacturer1.getAddress());
    });
  });

  describe("Stage tracking", function () {
    beforeEach(async function () {
      await contract
        .connect(manufacturer1)
        .createProduct("Coffee Beans", "Arabica beans", "Colombia");
    });

    it("allows the manufacturer to update the stage", async function () {
      await contract
        .connect(manufacturer1)
        .updateStage(1, Stage.InTransit, "Port A", "Shipped out");
      const product = await contract.getProduct(1);
      expect(product.currentStage).to.equal(Stage.InTransit);
    });

    it("records full checkpoint history via getCheckpoints", async function () {
      await contract
        .connect(manufacturer1)
        .updateStage(1, Stage.InTransit, "Port A", "Shipped out");
      const cps = await contract.getCheckpoints(1);
      expect(cps.length).to.equal(2);
      expect(cps[0].stage).to.equal(Stage.Created);
      expect(cps[1].stage).to.equal(Stage.InTransit);
      expect(cps[1].location).to.equal("Port A");
    });

    it("emits StageUpdated on a stage update", async function () {
      await expect(
        contract
          .connect(manufacturer1)
          .updateStage(1, Stage.InTransit, "Port A", "Shipped out")
      )
        .to.emit(contract, "StageUpdated")
        .withArgs(1n, Stage.InTransit, await manufacturer1.getAddress(), "Port A");
    });

    it("allows an authorized handler to update the stage", async function () {
      await contract.connect(manufacturer1).addHandler(1, await handler.getAddress());
      await contract
        .connect(handler)
        .updateStage(1, Stage.InTransit, "Port A", "Handled by courier");
      const product = await contract.getProduct(1);
      expect(product.currentStage).to.equal(Stage.InTransit);
    });

    it("rejects a stage update from an unauthorized address", async function () {
      await expect(
        contract.connect(other).updateStage(1, Stage.InTransit, "Port A", "notes")
      ).to.be.revertedWith("Not authorized");
    });

    it("rejects reverting to an earlier stage", async function () {
      await contract
        .connect(manufacturer1)
        .updateStage(1, Stage.Delivered, "Warehouse", "Delivered");
      await expect(
        contract.connect(manufacturer1).updateStage(1, Stage.InTransit, "Port A", "notes")
      ).to.be.revertedWith("Cannot revert stage");
    });

    it("allows setting the same stage again", async function () {
      await expect(
        contract.connect(manufacturer1).updateStage(1, Stage.Created, "Farm", "still created")
      ).to.not.be.reverted;
    });

    it("reverts updateStage on a nonexistent product", async function () {
      await expect(
        contract.connect(manufacturer1).updateStage(999, Stage.InTransit, "Port A", "notes")
      ).to.be.revertedWith("Product does not exist");
    });
  });

  describe("Handler management", function () {
    beforeEach(async function () {
      await contract
        .connect(manufacturer1)
        .createProduct("Coffee Beans", "Arabica beans", "Colombia");
    });

    it("only the manufacturer can add a handler", async function () {
      await expect(
        contract.connect(other).addHandler(1, await handler.getAddress())
      ).to.be.revertedWith("Not the manufacturer");
    });

    it("emits HandlerAdded", async function () {
      await expect(contract.connect(manufacturer1).addHandler(1, await handler.getAddress()))
        .to.emit(contract, "HandlerAdded")
        .withArgs(1n, await handler.getAddress());
    });

    it("isHandler reflects manufacturer and added handlers", async function () {
      expect(await contract.isHandler(1, await manufacturer1.getAddress())).to.equal(true);
      expect(await contract.isHandler(1, await handler.getAddress())).to.equal(false);
      await contract.connect(manufacturer1).addHandler(1, await handler.getAddress());
      expect(await contract.isHandler(1, await handler.getAddress())).to.equal(true);
      expect(await contract.isHandler(1, await other.getAddress())).to.equal(false);
    });
  });

  describe("Access control / Admin", function () {
    it("only owner can pause/unpause", async function () {
      await expect(contract.connect(other).pause()).to.be.reverted;
      await contract.connect(owner).pause();
      expect(await contract.paused()).to.equal(true);
    });

    it("blocks createProduct while paused", async function () {
      await contract.connect(owner).pause();
      await expect(
        contract.connect(manufacturer1).createProduct("A", "desc", "X")
      ).to.be.reverted;
    });

    it("allows operations again after unpause", async function () {
      await contract.connect(owner).pause();
      await contract.connect(owner).unpause();
      await expect(
        contract.connect(manufacturer1).createProduct("A", "desc", "X")
      ).to.not.be.reverted;
    });
  });

  describe("Multiple products", function () {
    it("tracks independent products for different manufacturers", async function () {
      await contract.connect(manufacturer1).createProduct("A", "descA", "X");
      await contract.connect(manufacturer2).createProduct("B", "descB", "Y");

      const p1 = await contract.getProduct(1);
      const p2 = await contract.getProduct(2);
      expect(p1.manufacturer).to.equal(await manufacturer1.getAddress());
      expect(p2.manufacturer).to.equal(await manufacturer2.getAddress());
      expect(await contract.getProductCount()).to.equal(2n);
    });
  });
});
