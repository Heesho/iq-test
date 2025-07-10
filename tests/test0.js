const convert = (amount, decimals) => ethers.utils.parseUnits(amount, decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;
const divDec6 = (amount, decimals = 6) => amount / 10 ** decimals;
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { execPath } = require("process");

const AddressZero = "0x0000000000000000000000000000000000000000";
const RandomNumber =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const pointZeroOne = convert("0.01", 18);
const one = convert("1", 18);
const ten = convert("10", 18);
const oneHundred = convert("100", 18);

let owner,
  treasury,
  incentives,
  developer,
  community,
  user0,
  user1,
  user2,
  user3,
  user4;
let base, curve, vaultFactory;

describe("local: test0", function () {
  before("Initial set up", async function () {
    console.log("Begin Initialization");

    [
      owner,
      treasury,
      incentives,
      developer,
      community,
      user0,
      user1,
      user2,
      user3,
      user4,
    ] = await ethers.getSigners();

    const vaultFactoryArtifact = await ethers.getContractFactory(
      "BerachainRewardVaultFactory"
    );
    vaultFactory = await vaultFactoryArtifact.deploy();
    console.log("- Vault Factory Initialized");

    const baseArtifact = await ethers.getContractFactory("Base");
    base = await baseArtifact.deploy();
    console.log("- BASE Initialized");

    const curveArtifact = await ethers.getContractFactory("Curve");
    curve = await curveArtifact.deploy(
      base.address,
      incentives.address,
      treasury.address,
      developer.address,
      community.address,
      vaultFactory.address,
      AddressZero
    );
    console.log("- Curve Initialized");

    console.log("Initialization Complete");
  });

  it("Distribute", async function () {
    console.log("******************************************************");
    await curve.distribute();
  });

  it("User0 takes test", async function () {
    console.log("******************************************************");
    const price = await curve.testPrice();
    await expect(
      curve.test(user0.address, RandomNumber, {
        value: price,
      })
    ).to.be.reverted;
  });

  it("Owner sets maxIndex to 10", async function () {
    console.log("******************************************************");
    await curve.setMaxIndex(10);
    const maxIndex = await curve.maxIndex();
    expect(maxIndex).to.equal(10);
  });

  it("User0 takes test", async function () {
    console.log("******************************************************");
    const price = await curve.testPrice();
    await expect(
      curve.test(user0.address, RandomNumber, {
        value: price,
      })
    ).to.be.revertedWith("Curve__InvalidScore");
  });

  it("Owner sets scores", async function () {
    console.log("******************************************************");
    await curve.setScore(0, 50);
    await curve.setScore(1, 60);
    await curve.setScore(2, 70);
    await curve.setScore(3, 80);
    await curve.setScore(4, 90);
    await curve.setScores([5, 6, 7, 8, 9, 10], [100, 110, 120, 130, 140, 150]);
  });
});
