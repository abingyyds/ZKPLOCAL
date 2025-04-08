require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          },
          outputSelection: {
            "*": {
              "*": ["*"]
            }
          }
        }
      }
    ]
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:7545",
      accounts: [
        "0x433f031528ea6630862c63d5cb5678af45bae9f876dcc307abfa5d753a4c7f4e"
      ],
      gas: 6721975,
      gasPrice: 20000000000
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
}; 