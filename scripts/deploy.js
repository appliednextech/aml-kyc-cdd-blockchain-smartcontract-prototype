const hre = require("hardhat");

async function main() {
  const Factory = await hre.ethers.getContractFactory("KycAmlCdd");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("KycAmlCdd deployed to:", addr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
