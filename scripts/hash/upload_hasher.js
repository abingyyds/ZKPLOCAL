const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { abi } = require('../../contracts/abi/CA.json');

// 配置
const CONFIG = {
    RPC_URL: "http://127.0.0.1:7545",
    CONTRACT_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    PRIVATE_KEY: "0x433f031528ea6630862c63d5cb5678af45bae9f876dcc307abfa5d753a4c7f4e",
    BATCH_SIZE: 10
};

// 初始化provider和wallet
const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, abi, wallet);

async function uploadHashers() {
    try {
        // 读取数据文件
        const dataPath = path.join(__dirname, '../../build/batch_proofs/all_data.json');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        
        // 读取Merkle数据
        const merklePath = path.join(__dirname, '../../config/merkle_data.json');
        const merkleData = JSON.parse(fs.readFileSync(merklePath, 'utf8'));
        
        // 使用第一个地址的证明
        const firstAddress = merkleData.leaves[0];
        const proofData = merkleData.proofs[firstAddress];
        if (!proofData) {
            throw new Error(`找不到地址 ${firstAddress} 的Merkle证明`);
        }
        
        // 更新Merkle根
        console.log('更新Merkle根...');
        const updateTx = await contract.updateMerkleRoot(merkleData.merkleRoot);
        await updateTx.wait();
        console.log('Merkle根更新成功!');
        
        console.log(`开始上传 ${data.length} 个hasher...`);
        
        // 批量上传
        for (let i = 0; i < data.length; i += CONFIG.BATCH_SIZE) {
            const batch = data.slice(i, i + CONFIG.BATCH_SIZE);
            
            console.log(`上传第 ${i/CONFIG.BATCH_SIZE + 1} 批数据 (${i+1}-${Math.min(i+CONFIG.BATCH_SIZE, data.length)})...`);
            
            for (const item of batch) {
                try {
                    const tx = await contract.uploadHasher(proofData.proof, item.hasher);
                    await tx.wait();
                    console.log(`Hasher ${item.hasher} 上传成功!`);
                } catch (error) {
                    console.error(`Hasher ${item.hasher} 上传失败:`, error);
                }
                
                // 等待一段时间再上传下一个
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // 每批之间等待更长时间
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        console.log('所有hasher上传完成!');
        
    } catch (error) {
        console.error('上传过程中发生错误:', error);
    }
}

// 执行上传
uploadHashers().catch(console.error); 