const { ethers } = require("hardhat");
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // 读取合约地址
        const caAddressPath = path.join(__dirname, '../config/ca_address.json');
        const caData = JSON.parse(fs.readFileSync(caAddressPath, 'utf8'));
        const caAddress = caData.address;

        logger.info(`监听 CA 合约地址: ${caAddress}`);

        // 获取合约实例
        const CA = await ethers.getContractFactory("MerkleTreeWhitelist");
        const ca = CA.attach(caAddress);

        // 监听所有事件
        logger.info("开始监听合约事件...");
        
        // 监听 HasherStatusChanged 事件
        ca.on("HasherStatusChanged", (hasher, status, event) => {
            logger.info("HasherStatusChanged 事件:");
            logger.info(`- Hasher: ${hasher}`);
            logger.info(`- 状态: ${status}`);
            logger.info(`- 区块号: ${event.blockNumber}`);
            logger.info(`- 交易哈希: ${event.transactionHash}`);
        });

        // 监听 VerificationResult 事件
        ca.on("VerificationResult", (hasher, isValid, hasherAvailable, event) => {
            logger.info("VerificationResult 事件:");
            logger.info(`- Hasher: ${hasher}`);
            logger.info(`- 验证结果: ${isValid}`);
            logger.info(`- Hasher可用: ${hasherAvailable}`);
            logger.info(`- 区块号: ${event.blockNumber}`);
            logger.info(`- 交易哈希: ${event.transactionHash}`);
        });

        // 监听 ReplayAttackAttempt 事件
        ca.on("ReplayAttackAttempt", (hasher, attacker, timestamp, reason, event) => {
            logger.info("ReplayAttackAttempt 事件:");
            logger.info(`- Hasher: ${hasher}`);
            logger.info(`- 攻击者: ${attacker}`);
            logger.info(`- 时间戳: ${timestamp}`);
            logger.info(`- 原因: ${reason}`);
            logger.info(`- 区块号: ${event.blockNumber}`);
            logger.info(`- 交易哈希: ${event.transactionHash}`);
        });

        logger.info("事件监听器已启动，按 Ctrl+C 停止监听");
    } catch (error) {
        logger.error("监听过程中出错:");
        logger.error(error.message);
        if (error.stack) {
            logger.error("错误堆栈:");
            logger.error(error.stack);
        }
        throw error;
    }
}

main()
    .then(() => {
        // 保持脚本运行
        process.on('SIGINT', () => {
            logger.info("停止监听");
            process.exit(0);
        });
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 