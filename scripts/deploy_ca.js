const { ethers } = require("hardhat");
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // 读取 Verifier 合约地址
        const verifierAddressPath = path.join(__dirname, '../config/verifier_address.json');
        const verifierData = JSON.parse(fs.readFileSync(verifierAddressPath, 'utf8'));
        const verifierAddress = verifierData.address;

        logger.info(`使用 Verifier 合约地址: ${verifierAddress}`);
        logger.info("开始部署 CA 合约...");

        // 初始的 Merkle 根
        const initialMerkleRoot = "0x70feb51e8972c3cad0bf9d99c51926c14c95a17b02fcaf70e6827cb39093323c";

        // 获取合约工厂
        const CA = await ethers.getContractFactory("MerkleTreeWhitelist");
        logger.info("合约工厂创建成功");
        
        // 部署合约
        logger.info("开始部署合约...");
        const ca = await CA.deploy(initialMerkleRoot, verifierAddress);
        logger.info("合约部署交易已发送");
        
        // 等待合约部署完成
        await ca.waitForDeployment();
        logger.info("合约部署成功");

        const caAddress = await ca.getAddress();
        logger.info(`CA 合约已部署到地址: ${caAddress}`);
        
        const deployTx = ca.deploymentTransaction();
        logger.info(`交易哈希: ${deployTx.hash}`);

        // 保存地址到文件
        const configDir = path.join(__dirname, '../config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir);
        }
        
        const caAddressPath = path.join(configDir, 'ca_address.json');
        fs.writeFileSync(caAddressPath, JSON.stringify({
            address: caAddress,
            deployTx: deployTx.hash,
            verifierAddress: verifierAddress
        }, null, 2));
        
        logger.info(`CA地址已保存到: ${caAddressPath}`);
    } catch (error) {
        logger.error("部署过程中出错:");
        logger.error(error.message);
        if (error.stack) {
            logger.error("错误堆栈:");
            logger.error(error.stack);
        }
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 