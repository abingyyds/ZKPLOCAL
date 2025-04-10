const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// 配置
const CONFIG = {
    RPC_URL: "http://127.0.0.1:7545",
    CONTRACT_ADDRESS: "0x3106962C2df0695CC7C089d3a1a0a441BEA2D10E",
    PRIVATE_KEY: "0x433f031528ea6630862c63d5cb5678af45bae9f876dcc307abfa5d753a4c7f4e",
};

// 合约ABI
const ABI = [
    "function verifyAndUseHasher(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[1] calldata input) external returns (bool)",
    "function isHasherSet(bytes32 _hasher) external view returns (bool)",
    "function getAllHashers() external view returns (bytes32[] memory)",
    "function updateMerkleRoot(bytes32 _newRoot) external",
    "function uploadHasher(bytes32[] calldata proof, bytes32 _hasher) external",
    "function owner() external view returns (address)",
    "function merkleRoot() external view returns (bytes32)",
    "function verifier() external view returns (address)",
    "event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot)",
    "event HasherMappingUpdated(bytes32 indexed hasher, bool status)",
    "event HasherStatusChanged(bytes32 indexed hasher, bool newStatus)",
    "event VerificationResult(bytes32 indexed hasher, bool isValid, bool hasherAvailable)",
    "event ReplayAttackAttempt(bytes32 indexed hasher, address attacker, uint256 timestamp, string reason)"
];

// 初始化provider和wallet
const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, ABI, wallet);

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
        contract.on("VerificationResult", (hasher, isValid, hasherAvailable, event) => {
            const verificationTime = Date.now();
            console.log(`\n[验证事件]`);
            console.log(`- Hasher: ${hasher}`);
            console.log(`- 验证是否有效: ${isValid}`);
            console.log(`- Hasher是否可用: ${hasherAvailable}`);
            console.log(`- 事件时间: ${verificationTime}ms`);
        });
        
        contract.on("ReplayAttackAttempt", (hasher, attacker, timestamp, reason, event) => {
            console.log(`\n[重放攻击事件]`);
            console.log(`- Hasher: ${hasher}`);
            console.log(`- 攻击者: ${attacker}`);
            console.log(`- 时间戳: ${new Date(timestamp * 1000).toLocaleString()}`);
            console.log(`- 原因: ${reason}`);
            console.log(`- 区块号: ${event.blockNumber}`);
            console.log(`- 交易哈希: ${event.transactionHash}`);
        });
        
        contract.on("HasherStatusChanged", (hasher, newStatus, event) => {
            console.log(`\n[Hasher状态变更事件]`);
            console.log(`- Hasher: ${hasher}`);
            console.log(`- 新状态: ${newStatus ? '可用' : '已使用'}`);
            console.log(`- 区块号: ${event.blockNumber}`);
            console.log(`- 交易哈希: ${event.transactionHash}`);
        });
        
        for (const item of hashersToVerify) {
            const startTime = Date.now();
            console.log(`\n验证 Hasher: ${item.hasher}`);
            
            try {
                // 先检查hasher是否存在
                const checkStart = Date.now();
                const hasherExists = await contract.isHasherSet(item.hasher);
                const checkTime = Date.now() - checkStart;
                
                if (!hasherExists) {
                    const result = {
                        hasher: item.hasher,
                        timings: {
                            totalTime: Date.now() - startTime,
                            checkHasherTime: checkTime,
                            proofVerificationTime: 0
                        },
                        status: 'failed',
                        reason: 'hasher不存在',
                        earlyExit: true
                    };
                    
                    console.log('快速验证结果:');
                    console.log(`- 检查hasher耗时: ${checkTime}ms`);
                    console.log(`- 原因: hasher不存在，无需进行ZKP验证`);
                    
                    // 在后台发送交易
                    (async () => {
                        try {
                            const [a, b, c, input] = parseSolidityData(item.solidityData);
                            const tx = await contract.verifyAndUseHasher(a, b, c, input);
                            console.log(`验证失败交易已发送，哈希: ${tx.hash}`);
                            const receipt = await tx.wait();
                            console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
                        } catch (error) {
                            console.error('交易发送失败:', error.message);
                        }
                    })();
                    
                    results.push(result);
                    continue;
                }
                
                // 解析solidityData
                const [a, b, c, input] = parseSolidityData(item.solidityData);
                
                // 使用callStatic模拟验证
                const proofStartTime = Date.now();
                const isValid = await contract.verifyAndUseHasher.staticCall(a, b, c, input);
                const proofTime = Date.now() - proofStartTime;
                
                const result = {
                    hasher: item.hasher,
                    timings: {
                        totalTime: Date.now() - startTime,
                        checkHasherTime: checkTime,
                        proofVerificationTime: proofTime
                    },
                    status: isValid ? 'success' : 'failed',
                    reason: isValid ? '验证成功' : '零知识证明无效',
                    earlyExit: false
                };
                
                console.log('验证结果:');
                console.log(`- 检查hasher耗时: ${checkTime}ms`);
                console.log(`- ZKP验证耗时: ${proofTime}ms`);
                console.log(`- 总耗时: ${result.timings.totalTime}ms`);
                console.log(`- 状态: ${result.reason}`);
                
                // 在后台发送交易
                (async () => {
                    try {
                        const tx = await contract.verifyAndUseHasher(a, b, c, input);
                        console.log(`验证交易已发送，哈希: ${tx.hash}`);
                        const receipt = await tx.wait();
                        console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
                    } catch (error) {
                        console.error('交易发送失败:', error.message);
                    }
                })();
                
                results.push(result);
                
            } catch (error) {
                const endTime = Date.now();
                const result = {
                    hasher: item.hasher,
                    timings: {
                        totalTime: endTime - startTime
                    },
                    status: 'failed',
                    error: error.message,
                    earlyExit: false
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
        
        // 移除所有事件监听器
        contract.removeAllListeners("VerificationResult");
        contract.removeAllListeners("ReplayAttackAttempt");
        contract.removeAllListeners("HasherStatusChanged");
        
    } catch (error) {
        console.error('验证过程出错:', error);
    }
}

verifyHashers().catch(console.error); 