const { ethers } = require("hardhat");
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        logger.info("开始部署 Verifier 合约...");

        // 获取合约工厂
        const Verifier = await ethers.getContractFactory("Groth16Verifier");
        logger.info("合约工厂创建成功");
        
        // 部署合约
        logger.info("开始部署合约...");
        const verifier = await Verifier.deploy();
        logger.info("合约部署交易已发送");
        
        // 等待合约部署完成
        await verifier.waitForDeployment();
        logger.info("合约部署成功");

        const verifierAddress = await verifier.getAddress();
        logger.info(`Verifier 合约已部署到地址: ${verifierAddress}`);
        
        const deployTx = verifier.deploymentTransaction();
        logger.info(`交易哈希: ${deployTx.hash}`);

        // 保存地址到文件
        const configDir = path.join(__dirname, '../config');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir);
        }
        
        const verifierAddressPath = path.join(configDir, 'verifier_address.json');
        fs.writeFileSync(verifierAddressPath, JSON.stringify({
            address: verifierAddress,
            deployTx: deployTx.hash
        }, null, 2));
        
        logger.info(`Verifier地址已保存到: ${verifierAddressPath}`);
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