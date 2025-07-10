const { ethers } = require("hardhat");
const { utils, BigNumber } = require("ethers");
const hre = require("hardhat");

// Constants
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
const convert = (amount, decimals) => ethers.utils.parseUnits(amount, decimals);
const divDec = (amount, decimals = 18) => amount / 10 ** decimals;
const pointZeroOne = convert("0.01", 18);

const WBERA_ADDRESS = "0x7507c1dc16935B82698e4C63f2746A2fCf994dF8"; // WBERA address

// Contract Variables
let units, key, factory, plugin, multicall;
let voter, rewardsVaultFactory;

/*===================================================================*/
/*===========================  CONTRACT DATA  =======================*/

async function getContracts() {
  units = await ethers.getContractAt(
    "contracts/Units.sol:Units",
    "0xC1e993A8769c4812D41Eccd40ba8D27375b8E856"
  );
  key = await ethers.getContractAt(
    "contracts/GamePass.sol:GamePass",
    "0x7a2939712E10D992669d9dAf18f6439E6928CCFe"
  );
  factory = await ethers.getContractAt(
    "contracts/Factory.sol:Factory",
    "0x6412c231C67d4e33b896b09de0350394f4FB8dC8"
  );
  plugin = await ethers.getContractAt(
    "contracts/QueuePlugin.sol:QueuePlugin",
    "0x171780b458B3c6080579CFB1c88Ff829f4E85327"
  );
  multicall = await ethers.getContractAt(
    "contracts/Multicall.sol:Multicall",
    "0x10Fe98626B5918be0A75e25F8fb33A18e4a803De"
  );
  voter = await ethers.getContractAt(
    "contracts/Voter.sol:Voter",
    "0x37bCEFA8DF86F046D91EE02510b118eEabF76816"
  );
  rewardsVaultFactory = await ethers.getContractAt(
    "contracts/BerachainRewardsVaultFactory.sol:BerachainRewardsVaultFactory",
    "0xDE0Dd69520DED525C4Be9c1a288Db6D0f5EB2a90"
  );
  console.log("Contracts Retrieved");
}

/*===========================  END CONTRACT DATA  ===================*/
/*===================================================================*/

async function deployRewardsVaultFactory() {
  console.log("Starting Rewards Vault Factory Deployment");
  const rewardsVaultFactoryArtifact = await ethers.getContractFactory(
    "BerachainRewardsVaultFactory"
  );
  const rewardsVaultFactoryContract =
    await rewardsVaultFactoryArtifact.deploy();
  rewardsVaultFactory = await rewardsVaultFactoryContract.deployed();
  console.log(
    "Rewards Vault Factory Deployed at:",
    rewardsVaultFactory.address
  );
}

async function deployVoter() {
  console.log("Starting Voter Deployment");
  const voterArtifact = await ethers.getContractFactory("Voter");
  const voterContract = await voterArtifact.deploy();
  voter = await voterContract.deployed();
  console.log("Voter Deployed at:", voter.address);
}

async function deployUnits() {
  console.log("Starting Units Deployment");
  const unitsArtifact = await ethers.getContractFactory("Units");
  const unitsContract = await unitsArtifact.deploy({
    gasPrice: ethers.gasPrice,
  });
  units = await unitsContract.deployed();
  await sleep(5000);
  console.log("Units Deployed at:", units.address);
}

async function deployKey(wallet) {
  console.log("Starting Key Deployment");
  const keyArtifact = await ethers.getContractFactory("GamePass");
  const keyContract = await keyArtifact.deploy(wallet.address, wallet.address, {
    gasPrice: ethers.gasPrice,
  });
  key = await keyContract.deployed();
  await sleep(5000);
  console.log("Key Deployed at:", key.address);
}

async function deployFactory() {
  console.log("Starting Factory Deployment");
  const factoryArtifact = await ethers.getContractFactory("Factory");
  const factoryContract = await factoryArtifact.deploy(
    units.address,
    key.address,
    {
      gasPrice: ethers.gasPrice,
    }
  );
  factory = await factoryContract.deployed();
  await sleep(5000);
  console.log("Factory Deployed at:", factory.address);
}

async function deployPlugin(wallet) {
  console.log("Starting Plugin Deployment");
  const pluginArtifact = await ethers.getContractFactory("QueuePlugin");
  const pluginContract = await pluginArtifact.deploy(
    WBERA_ADDRESS,
    voter.address,
    [WBERA_ADDRESS],
    [WBERA_ADDRESS],
    wallet.address,
    wallet.address,
    factory.address,
    units.address,
    key.address,
    rewardsVaultFactory.address,
    {
      gasPrice: ethers.gasPrice,
    }
  );
  plugin = await pluginContract.deployed();
  await sleep(5000);
  console.log("Plugin Deployed at:", plugin.address);
}

async function deployMulticall() {
  console.log("Starting Multicall Deployment");
  const multicallArtifact = await ethers.getContractFactory("Multicall");
  const multicallContract = await multicallArtifact.deploy(
    WBERA_ADDRESS,
    units.address,
    factory.address,
    key.address,
    plugin.address,
    await voter.OTOKEN(),
    {
      gasPrice: ethers.gasPrice,
    }
  );
  multicall = await multicallContract.deployed();
  console.log("Multicall Deployed at:", multicall.address);
}

async function printDeployment() {
  console.log("**************************************************************");
  console.log("Units: ", units.address);
  console.log("Key: ", key.address);
  console.log("Factory: ", factory.address);
  console.log("Plugin: ", plugin.address);
  console.log("Multicall: ", multicall.address);
  console.log("Voter: ", voter.address);
  console.log("RewardsVaultFactory: ", rewardsVaultFactory.address);
  console.log("**************************************************************");
}

async function verifyUnits() {
  await hre.run("verify:verify", {
    address: units.address,
    constructorArguments: [],
  });
}

async function verifyKey(wallet) {
  await hre.run("verify:verify", {
    address: key.address,
    constructorArguments: [wallet.address, wallet.address],
  });
}

async function verifyFactory() {
  await hre.run("verify:verify", {
    address: factory.address,
    constructorArguments: [units.address, key.address],
  });
}

async function verifyPlugin(wallet) {
  await hre.run("verify:verify", {
    address: plugin.address,
    constructorArguments: [
      WBERA_ADDRESS,
      voter.address,
      [WBERA_ADDRESS],
      [WBERA_ADDRESS],
      wallet.address,
      wallet.address,
      factory.address,
      units.address,
      key.address,
      rewardsVaultFactory.address,
    ],
  });
}

async function verifyMulticall() {
  await hre.run("verify:verify", {
    address: multicall.address,
    constructorArguments: [
      units.address,
      factory.address,
      key.address,
      plugin.address,
      await voter.OTOKEN(),
    ],
  });
}

async function setUpSystem(wallet) {
  console.log("Starting System Set Up");
  await units.connect(wallet).setMinter(factory.address, true);
  console.log("factory whitelisted to mint units.");
  await units.connect(wallet).setMinter(plugin.address, true);
  console.log("plugin whitelisted to mint units.");
  await voter.connect(wallet).setPlugin(plugin.address);
  console.log("plugin set for voter.");
  console.log("System Initialized");
}

async function setTools(wallet) {
  console.log("Starting Building Deployment");
  const buildingUps = [
    convert("0.0001", 18),
    convert("0.0002", 18),
    convert("0.0003", 18),
    convert("0.0004", 18),
    convert("0.0005", 18),
    convert("0.0006", 18),
    convert("0.0007", 18),
    convert("0.0008", 18),
    convert("0.001", 18),
    convert("0.0027", 18),
    convert("0.005", 18),
    convert("0.0075", 18),
    convert("0.015", 18),
    convert("0.025", 18),
    convert("0.1", 18),
    convert("0.2", 18),
    convert("0.3", 18),
    convert("0.4", 18),
    convert("0.5", 18),
    convert("1", 18),
  ];
  const buildingCost = [
    convert("1", 18),
    convert("2", 18),
    convert("3", 18),
    convert("4", 18),
    convert("5", 18),
    convert("8", 18),
    convert("11", 18),
    convert("15", 18),
    convert("20", 18),
    convert("50", 18),
    convert("100", 18),
    convert("150", 18),
    convert("300", 18),
    convert("500", 18),
    convert("1500", 18),
    convert("5000", 18),
    convert("15000", 18),
    convert("60000", 18),
    convert("250000", 18),
    convert("1000000", 18),
  ];
  await factory.connect(wallet).setTool(buildingUps, buildingCost);
  console.log("Buildings set");
}

async function setToolMultipliers(wallet) {
  console.log("Starting Multiplier Deployment");
  const buildingMultipliers = [
    convert("1", 18),
    convert("1.15", 18),
    convert("1.3225", 18),
    convert("1.520875", 18),
    convert("1.74900625", 18),
    convert("2.011357188", 18),
    convert("2.313060766", 18),
    convert("2.66001988", 18),
    convert("3.059022863", 18),
    convert("3.517876292", 18),
    convert("4.045557736", 18),
    convert("4.652391396", 18),
    convert("5.350250105", 18),
    convert("6.152787621", 18),
    convert("7.075705764", 18),
    convert("8.137061629", 18),
    convert("9.357620874", 18),
    convert("10.761264", 18),
    convert("12.37545361", 18),
    convert("14.23177165", 18),
    convert("16.36653739", 18),
    convert("18.821518", 18),
    convert("21.6447457", 18),
    convert("24.89145756", 18),
    convert("28.62517619", 18),
    convert("32.91895262", 18),
    convert("37.85679551", 18),
    convert("43.53531484", 18),
    convert("50.06561207", 18),
    convert("57.57545388", 18),
    convert("66.21177196", 18),
    convert("76.14353775", 18),
    convert("87.56506841", 18),
    convert("100.6998287", 18),
    convert("115.804803", 18),
    convert("133.1755234", 18),
    convert("153.1518519", 18),
    convert("176.1246297", 18),
    convert("202.5433242", 18),
    convert("232.9248228", 18),
    convert("267.8635462", 18),
    convert("308.0430782", 18),
    convert("354.2495399", 18),
    convert("407.3869709", 18),
    convert("468.4950165", 18),
    convert("538.769269", 18),
    convert("619.5846593", 18),
    convert("712.5223582", 18),
    convert("819.400712", 18),
    convert("942.3108188", 18),
    convert("1083.657442", 18),
    convert("1246.206058", 18),
    convert("1433.136966", 18),
    convert("1648.107511", 18),
    convert("1895.323638", 18),
    convert("2179.622184", 18),
    convert("2506.565512", 18),
    convert("2882.550338", 18),
    convert("3314.932889", 18),
    convert("3812.172822", 18),
    convert("4383.998746", 18),
    convert("5041.598558", 18),
    convert("5797.838341", 18),
    convert("6667.514092", 18),
    convert("7667.641206", 18),
    convert("8817.787387", 18),
    convert("10140.4555", 18),
    convert("11661.52382", 18),
    convert("13410.75239", 18),
    convert("15422.36525", 18),
    convert("17735.72004", 18),
    convert("20396.07804", 18),
    convert("23455.48975", 18),
    convert("26973.81321", 18),
    convert("31019.8852", 18),
    convert("35672.86798", 18),
    convert("41023.79817", 18),
    convert("47177.3679", 18),
    convert("54253.97308", 18),
    convert("62392.06904", 18),
    convert("71750.8794", 18),
    convert("82513.51131", 18),
    convert("94890.53801", 18),
    convert("109124.1187", 18),
    convert("125492.7365", 18),
    convert("144316.647", 18),
    convert("165964.144", 18),
    convert("190858.7656", 18),
    convert("219487.5805", 18),
    convert("252410.7176", 18),
    convert("290272.3252", 18),
    convert("333813.174", 18),
    convert("383885.1501", 18),
    convert("441467.9226", 18),
    convert("507688.111", 18),
    convert("583841.3276", 18),
    convert("671417.5268", 18),
    convert("772130.1558", 18),
    convert("887949.6792", 18),
    convert("1021142.131", 18),
  ];
  await factory.connect(wallet).setToolMultipliers(buildingMultipliers);
  console.log("Multipliers set");
}

async function setLevels(wallet) {
  console.log("Starting Level Deployment");
  await factory
    .connect(wallet)
    .setLvl(
      ["0", "10", "50", "500", "50000", "5000000"],
      [0, 1, 5, 25, 50, 100]
    );
  console.log("Levels set");
}

async function main() {
  const [wallet] = await ethers.getSigners();
  console.log("Using wallet: ", wallet.address);

  await getContracts();

  // await deployRewardsVaultFactory();
  // await deployVoter();
  // await deployUnits();
  // await deployKey(wallet);
  // await deployFactory();
  // await deployPlugin(wallet);
  // await deployMulticall();
  // await printDeployment();

  // await verifyUnits();
  // await verifyKey(wallet);
  // await verifyFactory();
  // await verifyPlugin(wallet);
  // await verifyMulticall();

  await setUpSystem(wallet);
  await setTools(wallet);
  await setToolMultipliers(wallet);
  await setLevels(wallet);

  // await plugin.setEntryFee("42690000000000000");

  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
