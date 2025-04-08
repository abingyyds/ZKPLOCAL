const { buildPoseidon } = require("circomlibjs");
const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");
const logger = require('../utils/logger');

async function calculateHash(nullifierValue) {
    try {
        // 1. 计算哈希
        const poseidon = await buildPoseidon();
        const nullifier = BigInt(nullifierValue);  // 将输入值转换为BigInt
        const hash = poseidon([nullifier]);
        const hashStr = poseidon.F.toString(hash);
        
        // 2. 准备input数据
        const input = {
            nullifier: nullifier.toString(),
            hasher: hashStr
        };
        
        // 3. 输出结果
        logger.info("=== 计算结果 ===");
        logger.info(`原始值 (nullifier): ${nullifier.toString()}`);
        logger.info(`哈希值 (hasher): 0x${hashStr}`);
        
        // 4. 保存input.json
        const circuitsDir = path.join(__dirname, "../../build/circuits");
        if (!fs.existsSync(circuitsDir)) {
            fs.mkdirSync(circuitsDir, { recursive: true });
        }
        const inputPath = path.join(circuitsDir, "input.json");
        fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));
        logger.info(`input.json已保存到: ${inputPath}`);
        
        return input;
    } catch (error) {
        logger.error("计算哈希时出错:", error);
        throw error;
    }
}

// 如果直接运行此脚本，使用命令行参数
if (require.main === module) {
    const nullifierValue = process.argv[2] || "123";  // 默认值为123
    calculateHash(nullifierValue);
} else {
    // 作为模块导出
    module.exports = calculateHash;
} 