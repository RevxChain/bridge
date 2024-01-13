// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IERC20Extended {

    function mint(address to, uint amount) external;

    function burn(uint amount) external;

    function burnFrom(address account, uint amount) external;

}