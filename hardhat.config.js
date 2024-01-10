require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require('dotenv').config();

const {
    PRIVATE_KEY,
    BSC_API_KEY,
    ETH_API_KEY,
    INFURA_ID_PROJECT
} = process.env;

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {},
        eth: {
            url: "https://rpc.ankr.com/eth",
            chainId: 1,
            gasPrice: 20000000000,
            accounts: [PRIVATE_KEY]
        },
        goerli: {
            url: "https://goerli.infura.io/v3/" + INFURA_ID_PROJECT,
            chainId: 5,
            // gasPrice: 0,
            accounts: [PRIVATE_KEY]
        },
        bsc: {
            url: "https://bsc-dataseed2.binance.org",
            chainId: 56,
            gasPrice: 5000000000,
            accounts: [PRIVATE_KEY]
        },
        bscTestnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            chainId: 97,
            // gasPrice: 10000000000,
            accounts: [PRIVATE_KEY]
        }
    },

    etherscan: {
        apiKey: {
            eth: ETH_API_KEY,
            goerli: ETH_API_KEY,
            bsc: BSC_API_KEY,
            bscTestnet: BSC_API_KEY
        }
    },

    solidity: {
        compilers: [
            {
                version: "0.8.19",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 99999,
                    },
                },
            },
        ],
    },

    gasReporter: {
        enabled: false,
    },

    contractSizer: {
        alphaSort: false,
        disambiguatePaths: false,
        runOnCompile: false,
        strict: false,
        only: [],
    }
}