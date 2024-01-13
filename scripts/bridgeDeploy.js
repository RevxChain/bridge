const hre = require("hardhat");
const ethers = hre.ethers;

const { 
    ADMIN, 
    TOKEN,
    INIT_SIGNERS,
    INIT_EXECUTORS,
    DESTINATION_CHAIN_ID,
    INPUT_FEE,
    MIN_AMOUNT,
    MAX_AMOUNT,
    MIN_CONFIRMATIONS
} = process.env;

async function main() {

    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.deploy(
        ADMIN, 
        TOKEN,
        INIT_SIGNERS,
        INIT_EXECUTORS,
        DESTINATION_CHAIN_ID,
        INPUT_FEE,
        MIN_AMOUNT,
        MAX_AMOUNT,
        MIN_CONFIRMATIONS
    );
    await bridge.waitForDeployment();

    console.log("Bridge deployed, address: ", bridge.target);

    await new Promise(x => setTimeout(x, 30000));
    await verify(bridge, [
        ADMIN, 
        TOKEN,
        INIT_SIGNERS,
        INIT_EXECUTORS,
        DESTINATION_CHAIN_ID,
        INPUT_FEE,
        MIN_AMOUNT,
        MAX_AMOUNT,
        MIN_CONFIRMATIONS
    ]);
}

async function verify(contract, constructorArguments) {
    await hre.run("verify:verify", {
      address: contract.address,
      constructorArguments: constructorArguments
    })
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});