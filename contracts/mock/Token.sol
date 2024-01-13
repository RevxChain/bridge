// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Token is ERC20Burnable {

    constructor(address receiver, uint initSupply) ERC20("TestToken","TT") {
        _mint(receiver, initSupply);
    }

    function mint(address to, uint amount) external {
        _mint(to, amount);
    }
}