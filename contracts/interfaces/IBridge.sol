// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IBridge {

    function inputFee() external view returns(uint);

    function minAmount() external view returns(uint);

    function maxAmount() external view returns(uint);

    function minConfirmations() external view returns(uint);

    function token() external view returns(address);

    function destinationChainId(uint chainId) external view returns(bool);

    function processedTransactions(uint transactionHash) external view returns(bytes32);

    function getFeeAmount(uint amount) external view returns(uint feeAmount, uint afterFeeAmount);

    function isProcessedTransaction(bytes32 transactionHash) external view returns(bool processed, bytes32 hashedParams);

    function getHashPacked(
        address user, 
        address bridge, 
        uint amount, 
        uint chainId,
        bytes32 transactionHash, 
        uint deadline
    ) external pure returns(bytes32);

    function toEthSignedMessageHash(bytes32 hash) external pure returns(bytes32);

    function ecOffsetRecover(bytes32 hash, bytes memory signature, uint offset) external pure returns(address);

    function deposit(uint amount, uint destinationChain) external;

    function execute(
        address receiver,
        uint amount,
        bytes32 transactionHash,
        uint deadline,
        bytes calldata signatures
    ) external;

    function setMinConfirmations(uint newMinConfirmations) external;

    function setFees(uint newInputFee) external;

    function setLimitAmounts(uint newMinAmount, uint newMaxAmount) external;

    function setDestinationChainId(uint chainId) external;

    function pauseBridge() external;

    function unpauseBridge() external;

}