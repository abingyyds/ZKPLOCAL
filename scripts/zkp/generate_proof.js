const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

class ZKProofGenerator {
    constructor(wasmPath, zkeyPath) {
        this.wasmPath = wasmPath;
        this.zkeyPath = zkeyPath;
    }

    // 生成证明
    async generateProof(inputs) {
        try {
            console.log('Generating proof with inputs:', inputs);
            const startTime = Date.now();

            // 生成证明
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                inputs,
                this.wasmPath,
                this.zkeyPath
            );

            const endTime = Date.now();
            console.log('Proof generation completed in', (endTime - startTime), 'ms');

            return {
                proof,
                publicSignals,
                generationTime: endTime - startTime
            };
        } catch (error) {
            console.error('Error generating proof:', error);
            throw error;
        }
    }

    // 验证证明
    async verifyProof(proof, publicSignals) {
        try {
            console.log('Verifying proof...');
            const startTime = Date.now();

            const verificationKey = JSON.parse(
                fs.readFileSync(
                    path.join(path.dirname(this.zkeyPath), 'verification_key.json'),
                    'utf8'
                )
            );

            const isValid = await snarkjs.groth16.verify(
                verificationKey,
                publicSignals,
                proof
            );

            const endTime = Date.now();
            console.log('Proof verification completed in', (endTime - startTime), 'ms');

            return {
                isValid,
                verificationTime: endTime - startTime
            };
        } catch (error) {
            console.error('Error verifying proof:', error);
            throw error;
        }
    }

    // 导出证明为Solidity可验证格式
    async exportSolidityCalldata(proof, publicSignals) {
        try {
            console.log('Exporting proof as Solidity calldata...');
            const calldata = await snarkjs.groth16.exportSolidityCallData(
                proof,
                publicSignals
            );

            // 解析calldata字符串为数组
            const argv = calldata
                .replace(/["[\]\s]/g, '')
                .split(',')
                .map(x => x.trim());

            // 提取a, b, c和input参数
            const a = [argv[0], argv[1]];
            const b = [
                [argv[2], argv[3]],
                [argv[4], argv[5]]
            ];
            const c = [argv[6], argv[7]];
            const input = argv.slice(8);

            return {
                a,
                b,
                c,
                input,
                raw: calldata
            };
        } catch (error) {
            console.error('Error exporting Solidity calldata:', error);
            throw error;
        }
    }

    // 生成完整的证明报告
    async generateFullReport(inputs) {
        try {
            console.log('Generating full ZK proof report...');
            const startTime = Date.now();

            // 生成证明
            const { proof, publicSignals, generationTime } = await this.generateProof(inputs);

            // 验证证明
            const { isValid, verificationTime } = await this.verifyProof(proof, publicSignals);

            // 导出Solidity calldata
            const solidityCalldata = await this.exportSolidityCalldata(proof, publicSignals);

            const endTime = Date.now();

            return {
                inputs,
                proof,
                publicSignals,
                verification: {
                    isValid,
                    verificationTime
                },
                solidityCalldata,
                timing: {
                    generationTime,
                    verificationTime,
                    totalTime: endTime - startTime
                }
            };
        } catch (error) {
            console.error('Error generating full report:', error);
            throw error;
        }
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    const wasmPath = process.argv[2];
    const zkeyPath = process.argv[3];
    const inputsJson = process.argv[4];

    if (!wasmPath || !zkeyPath || !inputsJson) {
        console.error('Usage: node generate_proof.js <wasm_path> <zkey_path> <inputs_json>');
        process.exit(1);
    }

    const inputs = JSON.parse(fs.readFileSync(inputsJson, 'utf8'));
    const generator = new ZKProofGenerator(wasmPath, zkeyPath);

    generator.generateFullReport(inputs)
        .then(report => {
            console.log('\nFull ZK Proof Report:');
            console.log(JSON.stringify(report, null, 2));
            process.exit(0);
        })
        .catch(error => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = ZKProofGenerator; 