const { MerkleTree } = require('merkletreejs');
const { calculateKeccak256Hash } = require('../hash/calculate_hash');

class CustomMerkleTree {
    constructor(leaves, hashFunction = calculateKeccak256Hash) {
        this.hashFunction = hashFunction;
        // 确保所有叶子节点都经过哈希处理
        this.hashedLeaves = leaves.map(leaf => 
            leaf.startsWith('0x') ? leaf : this.hashFunction(leaf)
        );
        // 创建Merkle树
        this.tree = new MerkleTree(this.hashedLeaves, this.hashFunction, {
            sortPairs: true
        });
    }

    // 获取Merkle根
    getRoot() {
        return this.tree.getHexRoot();
    }

    // 获取指定叶子节点的证明
    getProof(leaf) {
        const hashedLeaf = leaf.startsWith('0x') ? leaf : this.hashFunction(leaf);
        return this.tree.getHexProof(hashedLeaf);
    }

    // 验证证明
    verifyProof(leaf, proof) {
        const hashedLeaf = leaf.startsWith('0x') ? leaf : this.hashFunction(leaf);
        return this.tree.verify(proof, hashedLeaf, this.getRoot());
    }

    // 获取所有层级
    getLayers() {
        return this.tree.getLayers().map(layer => 
            layer.map(item => '0x' + item.toString('hex'))
        );
    }

    // 获取所有叶子节点
    getLeaves() {
        return this.hashedLeaves;
    }

    // 生成完整的树形结构报告
    generateReport() {
        return {
            root: this.getRoot(),
            leaves: this.getLeaves(),
            layers: this.getLayers(),
            proofs: this.hashedLeaves.map(leaf => ({
                leaf,
                proof: this.getProof(leaf)
            }))
        };
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    // 测试数据
    const testLeaves = [
        "0xba03CD7d4b6ACdaC86e3591f4C8EFD8fFB93a340",
        "0xA4B4F364C96d1Ce98b49Ae9C7dD39131855Cb3B2",
        "0x4B20993BC481177ec7E8f51c7ecA2b8A92E020edb",
        "0x78713DcA6b7B34ac0F824c42a7C18A495cabaB"
    ];

    // 创建Merkle树实例
    const merkleTree = new CustomMerkleTree(testLeaves);
    
    // 生成报告
    const report = merkleTree.generateReport();
    
    // 打印测试结果
    console.log('Merkle Tree Test Report:');
    console.log('Root:', report.root);
    console.log('\nLeaves:', report.leaves);
    console.log('\nLayers:', JSON.stringify(report.layers, null, 2));
    console.log('\nProofs:');
    report.proofs.forEach(({leaf, proof}, index) => {
        console.log(`\nLeaf #${index} - ${leaf}`);
        console.log('Proof:', JSON.stringify(proof, null, 2));
        console.log('Verification:', merkleTree.verifyProof(leaf, proof));
    });
}

module.exports = CustomMerkleTree; 