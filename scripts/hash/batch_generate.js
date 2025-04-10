const { exec } = require('child_process');
const calculateHash = require('./calculate_hash');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// 添加延时函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 将数字字符串转换为bytes32格式
function numberToBytes32(num) {
    const hex = BigInt(num).toString(16).padStart(64, '0');
    return `0x${hex}`;
}

async function runCommand(command, workDir) {
    return new Promise((resolve, reject) => {
        logger.info(`执行命令: ${command}`);
        logger.info(`在目录: ${workDir || process.cwd()}`);
        
        const options = workDir ? { cwd: workDir } : {};
        const childProcess = exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });

        childProcess.stdout.pipe(process.stdout);
        childProcess.stderr.pipe(process.stderr);
    });
}

async function generateRandomNumber() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
}

async function main() {
    try {
        const total = 100;
        const allData = [];
        
        logger.info(`开始生成 ${total} 个哈希值和证明...`);

        for (let i = 1; i <= total; i++) {
            try {
                // 1. 生成哈希值
                const nullifierValue = await generateRandomNumber();
                logger.info(`\n生成第 ${i}/${total} 个哈希值`);
                logger.info(`使用的 nullifier 值: ${nullifierValue}`);

                const input = await calculateHash(nullifierValue);
                const hashData = {
                    index: i,
                    nullifier: nullifierValue,
                    hasher: numberToBytes32(input.hasher)  // 转换为bytes32格式
                };

                // 2. 生成证明
                logger.info(`\n为第 ${i}/100 个哈希值生成证明`);

                // 2.1 准备input.json
                const circuitsDir = path.join(__dirname, "../../build/circuits");
                const inputPath = path.join(circuitsDir, "input.json");
                fs.writeFileSync(inputPath, JSON.stringify({
                    nullifier: nullifierValue,
                    hasher: input.hasher  // 这里保持原始格式，因为电路需要
                }, null, 2));

                // 2.2 生成witness
                logger.info("=== 1. 生成witness ===");
                await runCommand('node police_verify_js/generate_witness.js police_verify_js/police_verify.wasm input.json witness.wtns', circuitsDir);
                logger.info("witness生成成功！");

                // 2.3 生成proof
                logger.info("\n=== 2. 生成proof ===");
                await runCommand('snarkjs groth16 prove police_verify_final.zkey witness.wtns proof.json public.json', circuitsDir);
                logger.info("proof生成成功！");

                // 2.4 生成Solidity调用数据
                logger.info("\n=== 3. 生成Solidity调用数据 ===");
                const solidityData = await runCommand('snarkjs zkey export soliditycalldata public.json proof.json', circuitsDir);
                
                // 清理和格式化solidityData，只保留纯数字
                const cleanData = solidityData
                    .split('\n')          // 按换行符分割
                    .map(line => line.trim()) // 清理每行的空格
                    .join('')             // 重新连接，不添加任何分隔符
                    .replace(/\s+/g, '')  // 移除所有空格
                    .replace(/"/g, '')    // 移除引号
                    .replace(/0x/g, '')   // 移除0x前缀
                    .replace(/\[/g, '')   // 移除左括号
                    .replace(/\]/g, '')   // 移除右括号
                    .trim();              // 移除首尾空格
                
                logger.info("\n=== Remix调用参数（直接复制使用）===");
                logger.info(cleanData);

                // 2.5 读取生成的证明
                const proofPath = path.join(circuitsDir, "proof.json");
                const publicPath = path.join(circuitsDir, "public.json");
                
                const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
                const public = JSON.parse(fs.readFileSync(publicPath, 'utf8'));

                // 3. 合并数据
                const result = {
                    ...hashData,
                    proof: proof,
                    public: public,
                    solidityData: cleanData
                };
                
                allData.push(result);

                // 等待用户确认
                logger.info("\n请确认是否继续生成下一个...");
                await sleep(2000); // 给用户时间查看输出

            } catch (error) {
                logger.error(`生成第 ${i} 个数据时出错:`, error);
                continue;
            }
        }

        // 保存所有数据
        const outputDir = path.join(__dirname, "../../build/batch_proofs");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const outputPath = path.join(outputDir, 'all_data.json');
        fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2));
        logger.info(`所有数据已保存到: ${outputPath}`);

        logger.info("\n全部完成！");
        logger.info(`总数据数: ${allData.length}`);

    } catch (error) {
        logger.error("\n执行出错:", error);
        process.exit(1);
    }
}

main(); 