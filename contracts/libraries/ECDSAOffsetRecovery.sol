// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract ECDSAOffsetRecovery {

    uint public constant SIGNATURE_LENGTH = 65;

    mapping(bytes32 => bytes32) public processedTransactions;

    function isProcessedTransaction(bytes32 transactionHash) public view returns(bool processed, bytes32 hashedParams) {
        hashedParams = processedTransactions[transactionHash];
        processed = hashedParams != bytes32(0);
    }

    function getHashPacked(
        address user, 
        address bridge, 
        uint amount, 
        uint chainId,
        bytes32 transactionHash, 
        uint deadline
    ) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(user, bridge, amount, chainId, transactionHash, deadline));
    }

    function toEthSignedMessageHash(bytes32 hash) public pure returns(bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function ecOffsetRecover(bytes32 hash, bytes memory signature, uint offset) public pure returns(address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, add(offset, 0x20)))
            s := mload(add(signature, add(offset, 0x40)))
            v := byte(0, mload(add(signature, add(offset, 0x60))))
        }

        if(v < 27) v += 27;

        if(v != 27 && v != 28) return (address(0));

        return ecrecover(toEthSignedMessageHash(hash), v, r, s);
    }
}