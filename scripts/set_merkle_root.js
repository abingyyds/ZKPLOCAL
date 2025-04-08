const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

async function main() {
    try {
        // 读取 Merkle Tree 数据
        const merkleDataPath = path.join(__dirname, '../config/merkle_data.json');
        const merkleData = JSON.parse(fs.readFileSync(merkleDataPath, 'utf8'));
        const merkleRoot = merkleData.merkleRoot;

        // 读取合约地址
        const caAddressPath = path.join(__dirname, '../config/ca_address.json');
        const caData = JSON.parse(fs.readFileSync(caAddressPath, 'utf8'));
        const contractAddress = caData.address;

        logger.info(`使用合约地址: ${contractAddress}`);

        // 获取合约实例
        const MerkleTreeWhitelist = await ethers.getContractFactory("MerkleTreeWhitelist");
        const contract = await MerkleTreeWhitelist.attach(contractAddress);

        logger.info(`正在设置 Merkle Root: ${merkleRoot}`);
        
        // 调用合约的 updateMerkleRoot 函数
        const tx = await contract.updateMerkleRoot(merkleRoot);
        logger.info(`交易已发送: ${tx.hash}`);
        
        // 等待交易确认
        const receipt = await tx.wait();
        logger.info(`交易已确认，区块号: ${receipt.blockNumber}`);
        
        // 验证设置是否成功
        const currentRoot = await contract.merkleRoot();
        logger.info(`当前 Merkle Root: ${currentRoot}`);
        
        if (currentRoot.toLowerCase() === merkleRoot.toLowerCase()) {
            logger.info("Merkle Root 设置成功！");
        } else {
            logger.error("Merkle Root 设置失败！");
        }
    } catch (error) {
        logger.error("设置 Merkle Root 时发生错误：");
        logger.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 