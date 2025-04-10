// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; 

// 导入 OpenZeppelin 的 MerkleProof 库，用于验证 Merkle 树证明
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

// 验证器接口
interface IVerifier {
    // 修改参数为 calldata 类型
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata input
    ) external view returns (bool);
}

// Merkle树白名单合约
contract MerkleTreeWhitelist {
    // 合约拥有者地址
    address public owner;
    // 当前 Merkle 树的根哈希值
    bytes32 public merkleRoot;

    // 用于存储 hasher(nullifier) 值的映射，true表示可用，false表示已使用
    mapping(bytes32 => bool) public hasherMapping;
    // 存储所有上传的 hasher(nullifier) 值的数组，方便检索
    bytes32[] public allHashers;

    // 验证器合约接口
    IVerifier public immutable verifier;

    // 当 Merkle 根被更新时触发的事件
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    // 当新的 hasher(nullifier) 被上传时触发的事件
    event HasherMappingUpdated(bytes32 indexed hasher, bool status);
    event HasherStatusChanged(bytes32 indexed hasher, bool newStatus);
    // 新增：验证结果事件
    event VerificationResult(bytes32 indexed hasher, bool isValid, bool hasherAvailable);
    // 新增：重放攻击事件
    event ReplayAttackAttempt(
        bytes32 indexed hasher,
        address attacker,
        uint256 timestamp,
        string reason
    );

    // 错误定义
    error ZKPVerificationFailed();
    error HasherNotFound();
    error HasherAlreadyUsed();
    error ReplayAttack();

    // 修饰器：限制只有合约拥有者可以调用某些函数
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can perform this action");
        _;
    }

    // 构造函数：初始化 Merkle 根并设置合约拥有者
    constructor(bytes32 _merkleRoot, address _verifier) {
        owner = msg.sender; // 将部署合约的地址设置为合约拥有者
        merkleRoot = _merkleRoot; // 初始化 Merkle 根
        verifier = IVerifier(_verifier);
    }

    // 允许合约拥有者更新 Merkle 树根的函数
    function updateMerkleRoot(bytes32 _newRoot) external onlyOwner {
        emit MerkleRootUpdated(merkleRoot, _newRoot); // 发出更新事件以追踪变更
        merkleRoot = _newRoot; // 更新存储的 Merkle 根
    }

    // 允许白名单用户上传 hasher(nullifier) 值的函数
    function uploadHasher(bytes32[] calldata proof, bytes32 _hasher) external {
        // 验证发送者的地址是否在 Merkle 树中
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Invalid Merkle proof");

        // 记录 hasher 并发出事件
        hasherMapping[_hasher] = true;
        allHashers.push(_hasher);
        emit HasherMappingUpdated(_hasher, true);
    }

    // 修改后的验证并使用hasher的函数，先验证后上链
    function verifyAndUseHasher(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[1] calldata input
    ) external returns (bool) {
        bytes32 hasher = bytes32(input[0]);
        
        // 1. 检查hasher是否可用
        bool hasherAvailable = hasherMapping[hasher];
        
        // 2. 如果hasher不可用，直接返回false
        if (!hasherAvailable) {
            emit ReplayAttackAttempt(
                hasher,
                msg.sender,
                block.timestamp,
                "Hasher already used"
            );
            emit VerificationResult(hasher, false, hasherAvailable);
            return false;
        }
        
        // 3. 验证ZKP
        bool isValid = verifier.verifyProof(a, b, c, input);
        
        // 4. 发出验证结果事件
        emit VerificationResult(hasher, isValid, hasherAvailable);
        
        // 5. 如果验证失败，返回false
        if (!isValid) {
            emit ReplayAttackAttempt(
                hasher,
                msg.sender,
                block.timestamp,
                "Invalid ZKP proof"
            );
            return false;
        }
        
        // 6. 验证成功，标记hasher已使用
        hasherMapping[hasher] = false;
        emit HasherStatusChanged(hasher, false);
        
        return true;
    }

    // 查看函数：检查特定的 hasher(nullifier) 是否可用
    function isHasherSet(bytes32 _hasher) external view returns (bool) {
        return hasherMapping[_hasher]; // 直接返回hasher是否可用
    }

    // 查看函数：获取所有已上传的 hasher(nullifier) 值
    function getAllHashers() external view returns (bytes32[] memory) {
        return allHashers; // 返回所有 hasher 的数组
    }
}
