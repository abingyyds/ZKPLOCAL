const { exec } = require('child_process');
const calculateHash = require('./calculate_hash');
const logger = require('../utils/logger');
const path = require('path');

async function runCommand(command, workDir) {
    return new Promise((resolve, reject) => {
        logger.info(`\n执行命令: ${command}`);
        logger.info(`在目录: ${workDir || process.cwd()}`);
        
        const options = workDir ? { cwd: workDir } : {};
        const childProcess = exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });

        // 实时输出
        childProcess.stdout.pipe(process.stdout);
        childProcess.stderr.pipe(process.stderr);
    });
}

async function main() {
    try {
        // 获取命令行参数
        const nullifierValue = process.argv[2] || "63773700";  // 设置随机数
        logger.info("\n使用的nullifier值:", nullifierValue);

        // 第一步：运行calculate_hash
        logger.info("\n=== 第一步：计算哈希值 ===");
        await calculateHash(nullifierValue);

        // 第二步：运行generate_proof.js
        logger.info("\n=== 第二步：生成证明 ===");
        const circuitsDir = path.join(__dirname, "../../build/circuits");
        await runCommand('node generate_proof.js', circuitsDir);

        logger.info("\n=== 全部步骤执行完成！===");
    } catch (error) {
        logger.error("\n执行出错:", error);
        process.exit(1);
    }
}

main(); 