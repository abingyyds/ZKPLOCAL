const { exec } = require('child_process');
const calculateHash = require('./calculate_hash');

async function runCommand(command, workDir) {
    return new Promise((resolve, reject) => {
        console.log(`\n执行命令: ${command}`);
        console.log(`在目录: ${workDir || process.cwd()}`);
        
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
        const nullifierValue = process.argv[2] || "63773700";  // 设置随机数！！！！！！！！！！！！！！！！
        console.log("\n使用的nullifier值:", nullifierValue);

        // 第一步：运行calculate_hash
        console.log("\n=== 第一步：计算哈希值 ===");
        await calculateHash(nullifierValue);

        // 第二步：运行generate_proof.js
        console.log("\n=== 第二步：生成证明 ===");
        await runCommand('node generate_proof.js', '../build/circuits');

        console.log("\n=== 全部步骤执行完成！===");
    } catch (error) {
        console.error("\n执行出错:", error);
        process.exit(1);
    }
}

main(); 