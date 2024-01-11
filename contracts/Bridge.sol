// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./libraries/ECDSAOffsetRecovery.sol";
import "./interfaces/IERC20Extended.sol";

contract Bridge is Pausable, AccessControl, ReentrancyGuard, ECDSAOffsetRecovery {
    using SafeERC20 for IERC20;
 
    uint public constant MAX_FEE = 200;
    uint public constant PRECISION = 10000;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    uint public inputFee;
    uint public minAmount;
    uint public maxAmount;
    uint public minConfirmations;

    address public immutable token;

    mapping(uint => bool) public destinationChainId;

    event Deposited(
        address user, 
        address token,
        uint fromChainId, 
        uint destinationChainId,  
        uint afterFeeAmount, 
        uint time
    );

    event Bridged(
        address user, 
        address token, 
        uint chainId, 
        uint amount, 
        uint deadline,
        bytes32 txHash,
        uint time
    );

    modifier onlyOwnerOrManager() {
        require(hasRole(MANAGER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Bridge: forbidden");
        _;
    }

    constructor(
        address _admin, 
        address _token,  
        address[] memory _initSigners, 
        address[] memory _initExecutors,
        uint[] memory _destinationChainId,
        uint _inputFee,
        uint _minAmount,
        uint _maxAmount,
        uint _minConfirmations
    ) {
        require(_minConfirmations > 0, "Bridge: zero value");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        token = _token;
        inputFee = _inputFee;
        minAmount = _minAmount;
        maxAmount = _maxAmount;
        minConfirmations = _minConfirmations;

        for(uint i; _initSigners.length > i; i++) _grantRole(SIGNER_ROLE, _initSigners[i]);
        for(uint i; _initExecutors.length > i; i++) _grantRole(EXECUTOR_ROLE, _initExecutors[i]);
        for(uint i; _destinationChainId.length > i; i++) destinationChainId[_destinationChainId[i]] = true;
    }

    function deposit(uint amount, uint destinationChain) external whenNotPaused() nonReentrant() {
        validateAmount(amount);
        require(destinationChainId[destinationChain], "Bridge: invalid destination");

        (, uint _afterFeeAmount) = getFeeAmount(amount);

        IERC20Extended(token).burnFrom(msg.sender, amount);

        emit Deposited(msg.sender, token, block.chainid, destinationChain, _afterFeeAmount, block.timestamp);
    }

    function execute(
        address receiver,
        uint amount,
        bytes32 transactionHash,
        uint deadline,
        bytes calldata signatures
    ) external nonReentrant() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Bridge: forbidden");

        validateExecution(
            receiver,
            amount,
            transactionHash,
            deadline,
            signatures
        );

        IERC20Extended(token).mint(receiver, amount);

        emit Bridged(receiver, token, block.chainid, amount, deadline, transactionHash, block.timestamp);
    }

    function setMinConfirmations(uint newMinConfirmations) external onlyOwnerOrManager() {
        require(newMinConfirmations > 0, "Bridge: zero value");
        minConfirmations = newMinConfirmations;
    }

    function setFees(uint newInputFee) external onlyOwnerOrManager() {
        require(MAX_FEE >= newInputFee, "Bridge: invalid fee value");
        inputFee = newInputFee;
    }

    function setLimitAmounts(uint newMinAmount, uint newMaxAmount) external onlyOwnerOrManager() {
        if(newMaxAmount > 0) require(newMaxAmount > newMinAmount, "Bridge: newMinAmount exceed newMaxAmount");
        (minAmount, maxAmount) = (newMinAmount, newMaxAmount);
    }

    function setDestinationChainId(uint chainId) external onlyOwnerOrManager() {
        destinationChainId[chainId] = !destinationChainId[chainId];
    }

    function pauseBridge() external onlyOwnerOrManager() {
        _pause();
    }

    function unpauseBridge() external onlyOwnerOrManager() {
        _unpause();
    }

    function getFeeAmount(uint amount) public view returns(uint feeAmount, uint afterFeeAmount) {
        if(inputFee == 0) return (0, amount);
        feeAmount = amount * inputFee / PRECISION;
        afterFeeAmount = amount - feeAmount;
    }

    function validateAmount(uint amount) internal view {
        require(amount > 0, "Bridge: zero amount");
        if(minAmount > 0) require(amount >= minAmount, "Bridge: minAmount underflow");
        if(maxAmount > 0) require(maxAmount >= amount, "Bridge: maxAmount overflow");
    }

    function validateExecution(
        address user,
        uint amount,
        bytes32 transactionHash,
        uint deadline,
        bytes calldata signatures
    ) internal {
        require(deadline >= block.timestamp, "Bridge: expired");
        (uint _concatLength, uint _signaturesCount)= (signatures.length, signatures.length / SIGNATURE_LENGTH);
        require(_concatLength % SIGNATURE_LENGTH == 0, "Bridge: invalid signatures length");
        require(_signaturesCount >= minConfirmations, "Bridge: not enough confirmations"); 

        bytes32 _hashedParams = getHashPacked(user, address(this), amount, block.chainid, transactionHash, deadline);
        (bool _processed, bytes32 _savedHash) = isProcessedTransaction(transactionHash);
        require(!_processed && _savedHash != _hashedParams, "Bridge: executed");

        address[] memory _signerAddresses = new address[](_signaturesCount); 

        for(uint i; i < _signaturesCount; i++){
            address _signerAddress = ecOffsetRecover(_hashedParams, signatures, i * SIGNATURE_LENGTH);
            require(hasRole(SIGNER_ROLE, _signerAddress), "Bridge: not a signer");

            for(uint j; j < i; j++) require(_signerAddress != _signerAddresses[j], "Bridge: same signer");

            _signerAddresses[i] = _signerAddress;
        }

        processedTransactions[transactionHash] = _hashedParams;
    }
}