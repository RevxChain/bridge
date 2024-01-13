const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const helpers = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;

describe("Bridge", function () {
    async function deployTokenFixture() {

        const [deployer, admin, signer, signerTwo] = await ethers.getSigners();

        const initSupply = withDecimals("10000");

        const Token = await ethers.getContractFactory("Token", deployer);
        const token = await Token.deploy(admin.address, initSupply);
        await token.waitForDeployment();

        return { deployer, admin, token, signer, signerTwo };
    }

    async function deployBridgeFixture() {

        const [deployer, admin, user, executor, executorTwo, signer, signerTwo, thirdParty] = await ethers.getSigners();

        const initSupply = withDecimals("10000");

        const Token = await ethers.getContractFactory("Token", deployer);
        const token = await Token.deploy(admin.address, initSupply);
        await token.waitForDeployment();

        const inputFee = 0;
        const chainId = 31337;
        const minAmount = 0;
        const maxAmount = 0;
        const minConfirmations = 1;

        const Bridge = await ethers.getContractFactory("Bridge", deployer);
        const bridge = await Bridge.deploy(
            admin.address,
            token.target,
            [signer.address, signerTwo.address],
            [executor.address, executorTwo.address],
            [chainId],
            inputFee,
            minAmount,
            maxAmount,
            minConfirmations
        );
        await bridge.waitForDeployment();

        const adminRole = await bridge.DEFAULT_ADMIN_ROLE();
        const managerRole = await bridge.MANAGER_ROLE();
        const signerRole = await bridge.SIGNER_ROLE();
        const executorRole = await bridge.EXECUTOR_ROLE();

        const zeroHash = ethers.HashZero;
        const zeroAddress = ethers.AddressZero;

        const deadline = 90000000000;

        return {
            deployer, admin, user, executor, executorTwo, signer, signerTwo, thirdParty, token, bridge, adminRole, signerRole, managerRole,
            executorRole, inputFee, chainId, minAmount, maxAmount, minConfirmations, zeroHash, zeroAddress, deadline
        };
    }

    async function getSigns(someUser, receiver, amount, chainId, signer, signerTwo, bridgeAddress, deadline) {
        const txHash = ethers.solidityPackedKeccak256(
            ["address"],
            [someUser.address]
        );

        const messageHash = ethers.solidityPackedKeccak256(
            ["address", "address", "uint256", "uint256", "bytes32", "uint256"],
            [receiver.address, bridgeAddress.target, amount, chainId, txHash, deadline]
        );

        const messageHashBin = ethers.getBytes(messageHash);
        const signature = await signer.signMessage(messageHashBin);
        const signatureTwo = await signerTwo.signMessage(messageHashBin);
        const concatSignatures = signature + signatureTwo.slice(2);

        return { signature, signatureTwo, txHash, concatSignatures };
    }

    describe("Main", function () {
        describe("Init settings", function () {
            it("Init roles", async function () {
                const { admin, signer, signerTwo, bridge, adminRole, signerRole, executorRole, executor, executorTwo } = await loadFixture(deployBridgeFixture);

                expect(await bridge.hasRole(adminRole, admin.address)).to.equal(true);
                expect(await bridge.hasRole(signerRole, signer.address)).to.equal(true);
                expect(await bridge.hasRole(signerRole, signerTwo.address)).to.equal(true);
                expect(await bridge.hasRole(executorRole, executor.address)).to.equal(true);
                expect(await bridge.hasRole(executorRole, executorTwo.address)).to.equal(true);
            });

            it("Init storage", async function () {
                const { bridge, token, inputFee, chainId, minAmount, maxAmount, minConfirmations } = await loadFixture(deployBridgeFixture);

                expect(await bridge.token()).to.equal(token.target);
                expect(await bridge.inputFee()).to.equal(inputFee);
                expect(await bridge.minAmount()).to.equal(minAmount);
                expect(await bridge.maxAmount()).to.equal(maxAmount);
                expect(await bridge.minConfirmations()).to.equal(minConfirmations);
                expect(await bridge.destinationChainId(chainId)).to.equal(true);
            });

            it("Deploy", async function () {
                const { deployer, admin, token, signer, signerTwo } = await loadFixture(deployTokenFixture);

                const inputFee = 0;
                const destinationChainId = 31337;
                const minAmount = 0;
                const maxAmount = 0;
                const minConfirmations = 0;

                const Bridge = await ethers.getContractFactory("Bridge", deployer);
                await expect(Bridge.deploy(
                    admin.address,
                    token.target,
                    [signer.address, signerTwo.address],
                    [signer.address, signerTwo.address],
                    [destinationChainId],
                    inputFee,
                    minAmount,
                    maxAmount,
                    minConfirmations
                )).to.be.revertedWith("Bridge: zero value");
            });
        });

        describe("Admin's functions", function () {
            it("setMinConfirmations", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                const newValue = 2;

                await expect(bridge.connect(user).setMinConfirmations(newValue)).to.be.revertedWith(
                    "Bridge: forbidden"
                );

                await expect(bridge.connect(admin).setMinConfirmations(0)).to.be.revertedWith(
                    "Bridge: zero value"
                );

                await bridge.connect(admin).setMinConfirmations(newValue);

                expect(await bridge.minConfirmations()).to.equal(newValue);
            });

            it("setFees", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                const wrongInputValue = 201;
                const newInputValue = 2;

                await expect(bridge.connect(user).setFees(newInputValue)).to.be.revertedWith(
                    "Bridge: forbidden"
                );

                await expect(bridge.connect(admin).setFees(wrongInputValue)).to.be.revertedWith(
                    "Bridge: invalid fee value"
                );

                await bridge.connect(admin).setFees(newInputValue);

                expect(await bridge.inputFee()).to.equal(newInputValue);

                await bridge.connect(admin).setFees(0);
            });

            it("setLimitAmounts", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                const newMinValue = 1;
                const newMaxValue = 2;

                await expect(bridge.connect(user).setLimitAmounts(newMinValue, newMaxValue)).to.be.revertedWith(
                    "Bridge: forbidden"
                );

                await bridge.connect(admin).setLimitAmounts(newMinValue, newMaxValue);

                expect(await bridge.minAmount()).to.equal(newMinValue);
                expect(await bridge.maxAmount()).to.equal(newMaxValue);

                await expect(bridge.connect(admin).setLimitAmounts(newMinValue + 1, newMaxValue)).to.be.revertedWith(
                    "Bridge: newMinAmount exceed newMaxAmount"
                );

                await bridge.connect(admin).setLimitAmounts(0, 0);

                expect(await bridge.minAmount()).to.equal(0);
                expect(await bridge.maxAmount()).to.equal(0);

                await bridge.connect(admin).setLimitAmounts(newMinValue, 0);

                expect(await bridge.minAmount()).to.equal(newMinValue);
                expect(await bridge.maxAmount()).to.equal(0);

                await bridge.connect(admin).setLimitAmounts(0, 0);

                await bridge.connect(admin).setLimitAmounts(0, newMaxValue);

                expect(await bridge.minAmount()).to.equal(0);
                expect(await bridge.maxAmount()).to.equal(newMaxValue);
            });

            it("setDestinationChainId", async function () {
                const { admin, bridge, user, chainId } = await loadFixture(deployBridgeFixture);

                const newChainId = 100;

                await expect(bridge.connect(user).setDestinationChainId(newChainId)).to.be.revertedWith(
                    "Bridge: forbidden"
                );

                expect(await bridge.destinationChainId(newChainId)).to.equal(false);

                await bridge.connect(admin).setDestinationChainId(newChainId);

                expect(await bridge.destinationChainId(newChainId)).to.equal(true);

                await bridge.connect(admin).setDestinationChainId(newChainId);
                await bridge.connect(admin).setDestinationChainId(chainId);

                expect(await bridge.destinationChainId(newChainId)).to.equal(false);
                expect(await bridge.destinationChainId(chainId)).to.equal(false);
            });

            it("pauseBridge", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                await expect(bridge.connect(user).pauseBridge()).to.be.revertedWith(
                    "Bridge: forbidden"
                );

                await expect(bridge.connect(admin).unpauseBridge()).to.be.revertedWith(
                    "Pausable: not paused"
                );

                await bridge.connect(admin).pauseBridge();

                expect(await bridge.paused()).to.equal(true);
            });

            it("unpauseBridge", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                await bridge.connect(admin).pauseBridge();

                await expect(bridge.connect(user).unpauseBridge()).to.be.revertedWith(
                    "Bridge: forbidden"
                );

                await expect(bridge.connect(admin).pauseBridge()).to.be.revertedWith(
                    "Pausable: paused"
                );

                await bridge.connect(admin).unpauseBridge();

                expect(await bridge.paused()).to.equal(false);
            });
        });

        describe("getFeeAmount", function () {
            it("Should returns right values zero input fees", async function () {
                const { bridge } = await loadFixture(deployBridgeFixture);

                const amount = 10000;

                const fees = await bridge.getFeeAmount(amount);

                expect(fees.feeAmount).to.equal(0);
                expect(fees.afterFeeAmount).to.equal(amount);
            });

            it("Should returns right values non-zero input fees", async function () {
                const { admin, bridge } = await loadFixture(deployBridgeFixture);

                const newInputFee = 100;

                await bridge.connect(admin).setFees(newInputFee);

                const amount = 10000;

                const fees = await bridge.getFeeAmount(amount);

                expect(fees.feeAmount).to.equal(100);
                expect(fees.afterFeeAmount).to.equal(9900);
            });

            it("Should returns right values 2% fees", async function () {
                const { admin, bridge } = await loadFixture(deployBridgeFixture);

                const newInputFee = 200;

                await bridge.connect(admin).setFees(newInputFee);

                const amount = 10000;

                const feesInput = await bridge.getFeeAmount(amount);

                expect(feesInput.feeAmount).to.equal(200);
                expect(feesInput.afterFeeAmount).to.equal(9800);
            });
        });

        describe("Deposit", function () {
            it("Should revert while paused", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                await bridge.connect(admin).pauseBridge();

                await expect(bridge.connect(user).deposit(1, 31337)).to.be.revertedWith(
                    "Pausable: paused"
                );
            });

            it("Should revert zero amount", async function () {
                const { bridge, user } = await loadFixture(deployBridgeFixture);

                await expect(bridge.connect(user).deposit(0, 31337)).to.be.revertedWith(
                    "Bridge: zero amount"
                );
            });

            it("Should revert invalid destination chain Id", async function () {
                const { bridge, user } = await loadFixture(deployBridgeFixture);

                const newChainId = 100;

                await expect(bridge.connect(user).deposit(1, newChainId)).to.be.revertedWith(
                    "Bridge: invalid destination"
                );
            });

            it("Should revert minAmount underflow", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                const newMinAmount = 2;

                await bridge.connect(admin).setLimitAmounts(newMinAmount, 0);

                await expect(bridge.connect(user).deposit(newMinAmount - 1, 31337)).to.be.revertedWith(
                    "Bridge: minAmount underflow"
                );
            });

            it("Should revert maxAmount overflow", async function () {
                const { admin, bridge, user } = await loadFixture(deployBridgeFixture);

                const newMaxAmount = 2;

                await bridge.connect(admin).setLimitAmounts(0, newMaxAmount);

                await expect(bridge.connect(user).deposit(newMaxAmount + 1, 31337)).to.be.revertedWith(
                    "Bridge: maxAmount overflow"
                );
            });

            it("Should revert tx amounts overflow", async function () {
                const { admin, bridge, user, token } = await loadFixture(deployBridgeFixture);

                const newMaxAmount = 3;
                const newMinAmount = 2;

                await bridge.connect(admin).setLimitAmounts(newMinAmount, newMaxAmount);

                await expect(bridge.connect(user).deposit(newMaxAmount + 1, 31337)).to.be.revertedWith(
                    "Bridge: maxAmount overflow"
                );

                await expect(bridge.connect(user).deposit(newMinAmount - 1, 31337)).to.be.revertedWith(
                    "Bridge: minAmount underflow"
                );
                
                await token.connect(admin).mint(user.address, newMinAmount);
                await token.connect(user).approve(bridge.target, newMinAmount);

                await bridge.connect(user).deposit(newMinAmount, 31337);

                await bridge.connect(admin).setLimitAmounts(3, 4);
                await bridge.connect(admin).setLimitAmounts(0, 0);
            });

            it("Should revert user's invalid balance", async function () {
                const { token, bridge, user } = await loadFixture(deployBridgeFixture);

                const depositAmount = withDecimals("1");

                await token.connect(user).approve(bridge.target, depositAmount);

                await expect(bridge.connect(user).deposit(depositAmount, 31337)).to.be.revertedWith(
                    "ERC20: burn amount exceeds balance"
                );
            });

            it("Should right totalSupply with 0 fees", async function () {
                const { admin, token, bridge, user } = await loadFixture(deployBridgeFixture);

                const depositAmount = withDecimals("1");

                await token.connect(admin).mint(user.address, depositAmount);

                const totalSupplyBefore = await token.totalSupply();
                await token.connect(user).approve(bridge.target, depositAmount);

                await bridge.connect(user).deposit(depositAmount, 31337);

                const totalSupplyAfter = await token.totalSupply();

                expect(await token.balanceOf(bridge.target)).to.equal(0);
                expect(await token.balanceOf(user.address)).to.equal(0);
                expect(totalSupplyBefore).to.equal(totalSupplyAfter + depositAmount);
            });

            it("Should right totalSupply with 1% fees", async function () {
                const { admin, token, bridge, user } = await loadFixture(deployBridgeFixture);

                const depositAmount = withDecimals("1");

                await token.connect(admin).mint(user.address, depositAmount);
                await bridge.connect(admin).setFees(100);

                const totalSupplyBefore = await token.totalSupply();
                await token.connect(user).approve(bridge.target, depositAmount);

                await bridge.connect(user).deposit(depositAmount, 31337);

                const totalSupplyAfter = await token.totalSupply();

                expect(await token.balanceOf(bridge.target)).to.equal(0);
                expect(await token.balanceOf(user.address)).to.equal(0);
                expect(totalSupplyBefore).to.equal(totalSupplyAfter + depositAmount);
            });
        });

        describe("Execute", function () {
            it("Should revert wrong executor", async function () {
                const { bridge, user, deadline, chainId, signer } = await loadFixture(deployBridgeFixture);

                const amount = 1000;
                const { signature, txHash } = await getSigns(user, user, amount, chainId, signer, signer, bridge, deadline);

                await expect(bridge.connect(user).execute(user.address, amount, txHash, deadline, signature)).to.be.revertedWith(
                    "Bridge: forbidden"
                );
            });

            it("Should revert expired tx", async function () {
                const { bridge, executor, user, chainId, signer } = await loadFixture(deployBridgeFixture);

                const amount = 1000;
                const deadline = 0;

                const { signature, txHash } = await getSigns(user, user, amount, chainId, signer, signer, bridge, deadline);

                await expect(bridge.connect(executor).execute(user.address, amount, txHash, deadline, signature)).to.be.revertedWith(
                    "Bridge: expired"
                );
            });

            it("Should revert wrong signatures length", async function () {
                const { bridge, executor, deadline, chainId, signer } = await loadFixture(deployBridgeFixture);

                const amount = 1000;
                const { signature, txHash } = await getSigns(executor, executor, amount, chainId, signer, signer, bridge, deadline);

                await expect(bridge.connect(executor).execute(executor.address, amount, txHash, deadline, signature.slice(0, 20))).to.be.revertedWith(
                    "Bridge: invalid signatures length"
                );
            });

            it("Should revert wrong confirmations amount", async function () {
                const { signer, admin, bridge, executor, chainId, deadline } = await loadFixture(deployBridgeFixture);

                await bridge.connect(admin).setMinConfirmations(2);
                const amount = 1000;
                const { signature, txHash } = await getSigns(executor, executor, amount, chainId, signer, signer, bridge, deadline);

                await expect(bridge.connect(executor).execute(executor.address, 1, txHash, deadline, signature)).to.be.revertedWith(
                    "Bridge: not enough confirmations"
                );
            });

            it("Should revert wrong chainId", async function () {
                const { token, executor, signer, user, bridge, chainId, deadline } = await loadFixture(deployBridgeFixture);

                const totalSupplyBefore = await token.totalSupply();
                const amount = 1000;

                const { signature, txHash } = await getSigns(user, user, amount, chainId + 1, signer, signer, bridge, deadline);

                await expect(bridge.connect(executor).execute(user, amount, txHash, deadline, signature)).to.be.revertedWith(
                    "Bridge: not a signer"
                );

                const totalSupplyAfter = await token.totalSupply();

                expect(totalSupplyBefore).to.equal(totalSupplyAfter);
            });

            it("Should revert executed already", async function () {
                const { token, signer, bridge, executor, chainId, deadline } = await loadFixture(deployBridgeFixture);

                const totalSupplyBefore = await token.totalSupply();
                const amount = 1000;

                const { signature, txHash } = await getSigns(executor, executor, amount, chainId, signer, signer, bridge, deadline);

                await bridge.connect(executor).execute(executor, amount, txHash, deadline, signature);

                const totalSupplyAfter = await token.totalSupply();

                expect(totalSupplyAfter - totalSupplyBefore).to.equal(amount);

                await expect(bridge.connect(executor).execute(executor, amount, txHash, deadline, signature)).to.be.revertedWith(
                    "Bridge: executed"
                );
            });

            it("Should revert invalid signer", async function () {
                const { thirdParty, bridge, executor, chainId, deadline } = await loadFixture(deployBridgeFixture);

                const amount = 1000;

                const { signature, txHash } = await getSigns(executor, executor, amount, chainId, thirdParty, thirdParty, bridge, deadline);

                await expect(bridge.connect(executor).execute(executor, amount, txHash, deadline, signature)).to.be.revertedWith(
                    "Bridge: not a signer"
                );
            });

            it("Should revert same signer", async function () {
                const { signer, bridge, executor, chainId, deadline } = await loadFixture(deployBridgeFixture);

                const amount = 1000;

                const { signature, txHash } = await getSigns(executor, executor, amount, chainId, signer, signer, bridge, deadline);

                const concatSignatures = signature + signature.slice(2);

                await expect(bridge.connect(executor).execute(executor, amount, txHash, deadline, concatSignatures)).to.be.revertedWith(
                    "Bridge: same signer"
                );
            });

            it("Should revert different signatures", async function () {
                const { signer, bridge, executor, chainId, signerTwo, user, deadline } = await loadFixture(deployBridgeFixture);

                const amount = 1000;
                const amountTwo = 1001;

                const txHash = ethers.solidityPackedKeccak256(
                    ["address"],
                    [user.address]
                );

                const messageHash = ethers.solidityPackedKeccak256(
                    ["address", "address", "uint256", "uint256", "bytes32", "uint256"],
                    [user.address, bridge.target, amount, chainId, txHash, deadline]
                );

                const messageHashBin = ethers.getBytes(messageHash);
                const signature = await signer.signMessage(messageHashBin);

                const messageHashTwo = ethers.solidityPackedKeccak256(
                    ["address", "address", "uint256", "uint256", "bytes32", "uint256"],
                    [user.address, bridge.target, amountTwo, chainId, txHash, deadline]
                );

                const messageHashBinTwo = ethers.getBytes(messageHashTwo);
                const signatureTwo = await signerTwo.signMessage(messageHashBinTwo);

                const concatSignatures = signature + signatureTwo.slice(2);

                await expect(bridge.connect(executor).execute(executor, amount, txHash, deadline, concatSignatures)).to.be.revertedWith(
                    "Bridge: not a signer"
                );
            });

            it("Should pass by one signer", async function () {
                const { token, executor, signer, bridge, chainId, user, deadline } = await loadFixture(deployBridgeFixture);

                const totalSupplyBefore = await token.totalSupply();
                const amount = 1000;

                const { signature, txHash } = await getSigns(user, user, amount, chainId, signer, signer, bridge, deadline);

                await bridge.connect(executor).execute(user, amount, txHash, deadline, signature);

                const totalSupplyAfter = await token.totalSupply();

                expect(totalSupplyAfter - totalSupplyBefore).to.equal(amount);
            });

            it("Should pass by two signers", async function () {
                const { admin, executor, token, signer, signerTwo, bridge, chainId, user, deadline } = await loadFixture(deployBridgeFixture);

                const totalSupplyBefore = await token.totalSupply();
                const userBalanceBefore = await token.balanceOf(user.address);
                const amount = 1000;

                await bridge.connect(admin).setMinConfirmations(2);

                const { txHash, concatSignatures } = await getSigns(user, user, amount, chainId, signer, signerTwo, bridge, deadline);

                await bridge.connect(executor).execute(user, amount, txHash, deadline, concatSignatures);

                const totalSupplyAfter = await token.totalSupply();
                const userBalanceAfter = await token.balanceOf(user.address)

                expect(totalSupplyAfter - totalSupplyBefore).to.equal(amount);
                expect(userBalanceAfter - userBalanceBefore).to.equal(amount);
            });
        });
    });
});