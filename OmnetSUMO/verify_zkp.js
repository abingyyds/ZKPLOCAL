const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

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

/**
 * 检查合约连接和状态
 * @returns {Promise<boolean>} 连接是否成功
 */
async function checkContractConnection() {
    try {
        // 尝试获取合约代码
        const code = await provider.getCode(CONFIG.CONTRACT_ADDRESS);
        if (code === '0x') {
            console.error('错误: 合约地址上没有部署任何代码');
            return false;
        }
        
        console.log('合约代码已部署，长度:', code.length);
        
        // 尝试调用一个简单的view函数
        try {
            const hashers = await contract.getAllHashers();
            console.log(`合约连接成功，当前已注册的hasher数量: ${hashers.length}`);
            
            if (hashers.length > 0) {
                console.log('已注册的hasher列表:');
                hashers.forEach((hasher, index) => {
                    console.log(`  ${index + 1}. ${hasher}`);
                });
            }
            
            // 获取Merkle根
            try {
                const merkleRoot = await contract.getMerkleRoot();
                console.log(`Merkle根: ${merkleRoot}`);
            } catch (error) {
                console.log('无法获取Merkle根:', error.message);
            }
            
            // 获取白名单地址
            try {
                const whitelistedAddresses = await contract.getWhitelistedAddresses();
                console.log(`白名单地址数量: ${whitelistedAddresses.length}`);
                if (whitelistedAddresses.length > 0) {
                    console.log('白名单地址:');
                    whitelistedAddresses.forEach((address, index) => {
                        console.log(`  ${index + 1}. ${address}`);
                    });
                }
            } catch (error) {
                console.log('无法获取白名单地址:', error.message);
            }
            
            return true;
        } catch (error) {
            console.error('错误: 无法调用合约函数，可能是ABI不匹配或合约未正确部署');
            console.error(error.message);
            return false;
        }
    } catch (error) {
        console.error('错误: 无法连接到区块链网络');
        console.error(error.message);
        return false;
    }
}

/**
 * 验证零知识证明
 * @param {Object} proofData - 包含证明数据的对象
 * @param {Array} proofData.a - uint[2] 格式的证明数据
 * @param {Array} proofData.b - uint[2][2] 格式的证明数据
 * @param {Array} proofData.c - uint[2] 格式的证明数据
 * @param {Array} proofData.input - uint[1] 格式的输入数据
 * @returns {Promise<Object>} 验证结果
 */
async function verifyProof(proofData) {
    const startTime = Date.now();
    let checkHasherTime = 0;
    let staticCallTime = 0;
    let totalTime = 0;
    let verificationResult = null;
    let txHash = null;
    let blockNumber = null;
    
    try {
        // 从input中提取hasher值
        const hasher = proofData.input[0];
        
        // 先检查hasher是否已存在
        let hasherExists = false;
        const checkStart = Date.now();
        try {
            console.log(`检查hasher是否存在: ${hasher}`);
            hasherExists = await contract.isHasherSet(hasher);
            console.log(`hasher存在状态: ${hasherExists}`);
        } catch (error) {
            console.log('警告: 无法检查hasher是否存在，继续验证');
            console.log(error.message);
        }
        checkHasherTime = Date.now() - checkStart;
        
        // 如果hasher不存在，立即返回结果，但继续在后台发送交易
        if (!hasherExists) {
            totalTime = Date.now() - startTime;
            verificationResult = {
                success: true,
                verificationSuccess: false,
                hasherExists: false,
                hasher: hasher,
                verificationTime: totalTime,
                checkHasherTime: checkHasherTime,
                staticCallTime: 0,
                message: "验证失败：hasher不存在",
                earlyExit: true,
                txHash: null,
                blockNumber: null
            };
            
            // 在后台发送交易
            (async () => {
                try {
                    console.log('发送验证失败交易...');
                    const tx = await contract.verifyAndUseHasher(
                        proofData.a,
                        proofData.b,
                        proofData.c,
                        proofData.input
                    );
                    console.log(`交易已发送，哈希: ${tx.hash}`);
                    const receipt = await tx.wait();
                    console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
                } catch (error) {
                    console.error('交易发送失败:', error.message);
                }
            })();
            
            return verificationResult;
        }
        
        // 使用 callStatic 模拟执行验证
        console.log('模拟执行验证...');
        const staticCallStart = Date.now();
        const isValid = await contract.verifyAndUseHasher.staticCall(
            proofData.a,
            proofData.b,
            proofData.c,
            proofData.input
        );
        staticCallTime = Date.now() - staticCallStart;
        
        totalTime = Date.now() - startTime;
        
        // 返回验证结果
        verificationResult = {
            success: true,
            verificationSuccess: isValid,
            hasherExists: true,
            hasher: hasher,
            verificationTime: totalTime,
            checkHasherTime: checkHasherTime,
            staticCallTime: staticCallTime,
            message: isValid ? "验证成功" : "验证失败：零知识证明无效",
            earlyExit: false,
            txHash: null,
            blockNumber: null
        };
        
        // 在后台发送实际交易
        (async () => {
            try {
                console.log('发送验证交易...');
                const tx = await contract.verifyAndUseHasher(
                    proofData.a,
                    proofData.b,
                    proofData.c,
                    proofData.input
                );
                console.log(`交易已发送，哈希: ${tx.hash}`);
                const receipt = await tx.wait();
                console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
            } catch (error) {
                console.error('交易发送失败:', error.message);
            }
        })();
        
        return verificationResult;
    } catch (error) {
        const endTime = Date.now();
        return {
            success: false,
            error: error.message,
            verificationTime: endTime - startTime,
            checkHasherTime: checkHasherTime,
            staticCallTime: staticCallTime,
            message: "验证失败：" + error.message,
            earlyExit: false,
            txHash: null,
            blockNumber: null
        };
    }
}

// 设置事件监听器
contract.on("VerificationResult", (hasher, isValid, hasherAvailable, event) => {
    console.log(`\n[验证事件]`);
    console.log(`- Hasher: ${hasher}`);
    console.log(`- 验证是否有效: ${isValid}`);
    console.log(`- Hasher是否可用: ${hasherAvailable}`);
    console.log(`- 区块号: ${event.blockNumber}`);
    console.log(`- 交易哈希: ${event.transactionHash}`);
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

// 主函数
async function main() {
    // 从命令行参数获取证明数据
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.log('使用方法: node verify_zkp.js <纯数字格式的证明数据>');
        console.log('示例: node verify_zkp.js 1b5af74076811330aa7d12f0d33792b903ce379b75f6bd036f84fcdfcb370fdb,1ec3a6fb0d9d00fb76cf890f4c169b9bb87b199fa485daa08014c9c595e1ebf1,163038816f03afd9f5c580c62e4e20f5901fd07806945d85681f7fd8a279bb9d,0ca59065004b17b8e57345964e40947afc4bc5c8be0dbbb3ba0aa11fdb7ba944,07f6b9117da430eb85f2b75cccb21a37d1fba1e65296789ee9806930e0461b20,1483b21328ade96df471d47909c8e10ac56f5b99f342479191a807bc158e41b5,0632b5d3b68636fac063f18feb09cd62bd2d9251c81c5dc5427ca4806b4dfc40,16c4251e5110ac56f757de862cf70430878b5f3605cbb7859af26b12a2355e63,0246fd0fcd16776a139260d4e8972b5c4e7c099dda7a22e31bdb04224cc5b066');
        process.exit(1);
    }

    try {
        // 检查合约连接
        console.log('检查合约连接...');
        const isConnected = await checkContractConnection();
        if (!isConnected) {
            console.error('无法连接到合约，请检查合约地址和网络设置');
            process.exit(1);
        }
        
        // 解析纯数字格式的输入数据
        const numbers = args[0].split(',');
        if (numbers.length !== 9) {
            throw new Error('输入数据格式错误，需要9个数字');
        }

        // 格式化数据
        const proofData = {
            a: [`0x${numbers[0]}`, `0x${numbers[1]}`],
            b: [[`0x${numbers[2]}`, `0x${numbers[3]}`], [`0x${numbers[4]}`, `0x${numbers[5]}`]],
            c: [`0x${numbers[6]}`, `0x${numbers[7]}`],
            input: [`0x${numbers[8]}`]
        };

        // 验证数据格式
        if (!Array.isArray(proofData.a) || proofData.a.length !== 2 ||
            !Array.isArray(proofData.b) || proofData.b.length !== 2 || !Array.isArray(proofData.b[0]) || proofData.b[0].length !== 2 ||
            !Array.isArray(proofData.c) || proofData.c.length !== 2 ||
            !Array.isArray(proofData.input) || proofData.input.length !== 1) {
            throw new Error('数据格式不正确');
        }

        // 验证所有数据都是十六进制格式
        const validateHex = (arr) => {
            return arr.every(item => 
                typeof item === 'string' && 
                item.startsWith('0x') && 
                /^0x[0-9a-fA-F]{64}$/.test(item)
            );
        };

        if (!validateHex(proofData.a) || 
            !validateHex(proofData.b[0]) || !validateHex(proofData.b[1]) ||
            !validateHex(proofData.c) || 
            !validateHex(proofData.input)) {
            throw new Error('数据必须是64位十六进制格式（以0x开头）');
        }

        console.log('开始验证证明...');
        console.log(`Hasher值: ${proofData.input[0]}`);
        
        const result = await verifyProof(proofData);
        
        // 显示验证结果
        console.log('\n验证结果:');
        console.log(`- 状态: ${result.message}`);
        console.log(`- 总耗时: ${result.verificationTime}ms`);
        
        if (result.earlyExit) {
            console.log('\n快速验证结果（仅检查hasher）:');
            console.log(`- 检查hasher耗时: ${result.checkHasherTime}ms`);
            console.log(`- 原因: hasher不存在，无需进行ZKP验证`);
            console.log('\n注意: 验证失败交易正在后台发送到区块链...');
        } else {
            console.log('\n完整验证过程:');
            console.log(`- 检查hasher耗时: ${result.checkHasherTime}ms`);
            console.log(`- ZKP验证耗时: ${result.staticCallTime}ms`);
            console.log(`- 总耗时: ${result.verificationTime}ms`);
            console.log('\n注意: 验证交易正在后台发送到区块链...');
        }
        
        if (result.success) {
            console.log('\n交易详情:');
            console.log(`- Hasher值: ${proofData.input[0]}`);
            console.log(`- Hasher存在: ${result.hasherExists}`);
            console.log(`- ZKP验证结果: ${result.verificationSuccess ? '成功' : '失败'}`);
        } else {
            console.log('\n错误详情:');
            console.log(`- 错误信息: ${result.error}`);
        }
    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
    main().catch(console.error);
}

// 导出函数供其他文件使用
module.exports = {
    verifyProof
}; 