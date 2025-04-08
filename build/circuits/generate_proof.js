const snarkjs = require("snarkjs");
const path = require("path");
const fs = require("fs");

async function generateProof() {
    try {
        console.log("\n=== 1. 生成witness ===");
        // 使用snarkjs的wtns计算函数
        await snarkjs.wtns.calculate(
            JSON.parse(fs.readFileSync("input.json")),
            "police_verify_js/police_verify.wasm",
            "witness.wtns"
        );
        console.log("witness生成成功！");

        console.log("\n=== 2. 生成proof ===");
        // 生成proof
        const { proof, publicSignals } = await snarkjs.groth16.prove(
            "police_verify_final.zkey",
            "witness.wtns"
        );

        // 保存proof和public signals
        fs.writeFileSync("proof.json", JSON.stringify(proof, null, 2));
        fs.writeFileSync("public.json", JSON.stringify(publicSignals, null, 2));
        console.log("proof生成成功！");

        console.log("\n=== 3. 生成Solidity调用数据 ===");
        // 生成calldata
        const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        console.log("\n=== Remix调用参数（直接复制使用）===");
        console.log(calldata);

    } catch (error) {
        console.error("\n错误:", error);
    }
}

generateProof()
    .then(() => console.log("\n全部完成！"))
    .catch(console.error); 