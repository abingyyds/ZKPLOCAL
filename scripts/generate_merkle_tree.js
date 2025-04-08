const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');

// Sample leaves data - 修正地址格式，确保每个地址都是有效的
const leaves = [
    "0xCB5d5BF3C99ADdc4E569a9052F93B23c47D82DeB",
    "0x9c0689a8A824efcF52Fe006F8cDfca54cD3d93fA",
    "0x78A6F3df09b639f163D2fe822EB03A5583A54EA6",
    "0x64629cC8845a8DF710c2A26E4c9401076cb80758"
];

// 直接对原始数据进行哈希处理
const hashedLeaves = leaves.map(leaf => keccak256(leaf));

// Generate Merkle Tree
const tree = new MerkleTree(hashedLeaves, keccak256, { 
    sortPairs: true
});

// 输出 Merkle Root
const merkleRoot = tree.getHexRoot();
logger.info(`Merkle Root: ${merkleRoot}`);

// 输出叶子节点的哈希值
logger.info('Leaves:');
const hashedLeavesHex = hashedLeaves.map(leaf => '0x' + leaf.toString('hex'));
logger.info(JSON.stringify(hashedLeavesHex, null, 2));

// 输出所有层级
logger.info('Layers:');
const layers = tree.getLayers().map(layer => 
    layer.map(x => '0x' + x.toString('hex'))
);
logger.info(JSON.stringify(layers, null, 2));

logger.info("Proofs for each leaf:");
const proofs = {};
for (let i = 0; i < hashedLeaves.length; i++) {
    const hashedLeaf = '0x' + hashedLeaves[i].toString('hex');
    logger.info(`\nLeaf #${i} - ${hashedLeaf}`);
    logger.info("Proof:");
    const proof = tree.getHexProof(hashedLeaves[i]);
    logger.info(JSON.stringify(proof, null, 2));
    
    // 保存每个地址的证明
    proofs[leaves[i]] = {
        leaf: hashedLeaf,
        proof: proof
    };
}

// 保存结果到文件
const configDir = path.join(__dirname, '../config');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
}

const merkleDataPath = path.join(configDir, 'merkle_data.json');
fs.writeFileSync(merkleDataPath, JSON.stringify({
    merkleRoot: merkleRoot,
    leaves: leaves,
    hashedLeaves: hashedLeavesHex,
    layers: layers,
    proofs: proofs
}, null, 2));

logger.info(`Merkle Tree 数据已保存到: ${merkleDataPath}`); 