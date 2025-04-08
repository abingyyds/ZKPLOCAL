const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { abi } = require('../../contracts/abi/CA.json');

// 配置
const CONFIG = {
    RPC_URL: "http://127.0.0.1:7545",
    CONTRACT_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    PRIVATE_KEY: "0x433f031528ea6630862c63d5cb5678af45bae9f876dcc307abfa5d753a4c7f4e",
};

// 初始化provider和wallet
const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, abi, wallet);

function parseSolidityData(solidityData) {
    try {
        // 移除换行符和多余的空格
        const cleanData = solidityData.replace(/\n/g, '').trim();
        
        // 使用正则表达式提取数据
        const matches = cleanData.match(/\[(.*?)\],\[\[(.*?)\],\[(.*?)\]\],\[(.*?)\],\[(.*?)\]/);
        if (!matches) {
            throw new Error('数据格式不正确');
        }
        
        // 处理第一部分 (a)
        const a = matches[1].split(',').map(x => x.trim().replace(/"/g, ''));
        
        // 处理第二部分 (b)
        const bParts = matches[2].split('],[');
        const b = [
            bParts[0].split(',').map(x => x.trim().replace(/"/g, '')),
            matches[3].split(',').map(x => x.trim().replace(/"/g, ''))
        ];
        
        // 处理第三部分 (c)
        const c = matches[4].split(',').map(x => x.trim().replace(/"/g, ''));
        
        // 处理第四部分 (input)
        const input = matches[5].split(',').map(x => x.trim().replace(/"/g, ''));
        
        return [a, b, c, input];
    } catch (error) {
        console.error('解析solidityData时出错:', error);
        throw error;
    }
}

async function verifyHashers() {
    try {
        // 读取数据文件
        const dataPath = path.join(__dirname, '../../build/batch_proofs/all_data.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        // 只验证前10个hasher
        const hashersToVerify = data.slice(0, 10);
        
        console.log('开始验证hasher...');
        console.log('----------------------------------------');
        
        const results = [];
        
        // 设置事件监听器
        contract.on("VerificationResult", (hasher, isValid, hasherExists, event) => {
            const verificationTime = Date.now();
            console.log(`收到验证事件:`);
            console.log(`- Hasher: ${hasher}`);
            console.log(`- 验证是否有效: ${isValid}`);
            console.log(`- Hasher是否存在: ${hasherExists}`);
            console.log(`- 事件时间: ${verificationTime}ms`);
        });
        
        for (const item of hashersToVerify) {
            const startTime = Date.now();
            console.log(`\n验证 Hasher: ${item.hasher}`);
            
            try {
                // 解析solidityData
                const [a, b, c, input] = parseSolidityData(item.solidityData);
                
                // 直接验证零知识证明
                const proofStartTime = Date.now();
                const tx = await contract.verifyAndUseHasher(
                    a,  // uint[2]
                    b,  // uint[2][2]
                    c,  // uint[2]
                    input  // uint[1]
                );
                
                // 交易发送时间
                const txSentTime = Date.now();
                
                const result = {
                    hasher: item.hasher,
                    timings: {
                        totalTime: txSentTime - startTime,
                        proofVerificationTime: txSentTime - proofStartTime
                    },
                    status: 'success',
                    transactionHash: tx.hash
                };
                
                console.log('交易已发送!');
                console.log('时间统计:');
                console.log(`- 总耗时: ${result.timings.totalTime}ms`);
                console.log(`- 证明验证耗时: ${result.timings.proofVerificationTime}ms`);
                console.log(`- 交易哈希: ${result.transactionHash}`);
                
                results.push(result);
                
            } catch (error) {
                const endTime = Date.now();
                const result = {
                    hasher: item.hasher,
                    timings: {
                        totalTime: endTime - startTime
                    },
                    status: 'failed',
                    error: error.message
                };
                
                console.log('验证失败:', error.message);
                console.log(`总耗时: ${result.timings.totalTime}ms`);
                
                results.push(result);
            }
            
            // 等待一小段时间以确保事件被接收
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 保存结果
        const resultsPath = path.join(__dirname, '../../build/batch_proofs/verification_results.json');
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        console.log('\n验证结果已保存到:', resultsPath);
        
        // 等待几秒钟以确保所有事件都被接收
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 移除事件监听器
        contract.removeAllListeners("VerificationResult");
        
    } catch (error) {
        console.error('验证过程出错:', error);
    }
}

verifyHashers().catch(console.error); 