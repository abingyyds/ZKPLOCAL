pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/gates.circom";

template HasherVerifier() {
    // 公开输入 - 这个是我们要验证的哈希值
    signal input hasher;    
    
    // 私密输入 - 这个是哈希的原像，我们要证明我们知道它
    signal input nullifier;

    // 1. 验证nullifier不为0
    component isZero = IsZero();
    isZero.in <== nullifier;
    component notZero = NOT();
    notZero.in <== isZero.out;
    notZero.out === 1;

    // 2. 验证nullifier在合理范围内
    component nullifierBits = Num2Bits(252);
    nullifierBits.in <== nullifier;

    // 3. 计算和验证hasher
    component hasherCalc = Poseidon(1);
    hasherCalc.inputs[0] <== nullifier;
    hasherCalc.out === hasher;
}

component main {public [hasher]} = HasherVerifier();