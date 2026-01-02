import { Buffer } from 'buffer'; // Import Buffer
import { Asset } from 'expo-asset';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import RNFS from 'react-native-fs'; // Import react-native-fs
import { VietnameseG2P } from './vietnamese_g2p.js';

export class ValtecTTSEngine {
    private sessions: any = {};
    private symbolToId: any;
    private viLangId: number = 7;
    private isInitialized = false;

    async initialize() {
        const config = require('../../model/tts_config.json')
        this.symbolToId = config.symbol_to_id;
        this.viLangId = config.language_id_map?.VI ?? 7;

        const options = { executionProviders: ['coreml', 'cpu'] };

        const readAsset = async (assetModule: any): Promise<Buffer> => {
            const asset = Asset.fromModule(assetModule);
            if (!asset.localUri) {
                await asset.downloadAsync();
            }
            if (!asset.localUri) {
                throw new Error(`Failed to get local URI for asset: ${asset.name}`);
            }
            const base64 = await RNFS.readFile(asset.localUri, 'base64');
            return Buffer.from(base64, 'base64');
        };

        const textEncoderBytes = await readAsset(require('../../model/text_encoder.onnx'));
        this.sessions.textEncoder = await InferenceSession.create(textEncoderBytes, options);

        const durationPredictorBytes = await readAsset(require('../../model/duration_predictor.onnx'));
        this.sessions.durationPredictor = await InferenceSession.create(durationPredictorBytes, options);

        const flowBytes = await readAsset(require('../../model/flow.onnx'));
        this.sessions.flow = await InferenceSession.create(flowBytes, options);

        const decoderBytes = await readAsset(require('../../model/decoder.onnx'));
        this.sessions.decoder = await InferenceSession.create(decoderBytes, options);

        this.isInitialized = true;
    }

    async synthesize(text: string, speakerId: number = 1, lengthScale: number = 1.0, noiseScale: number = 0.667) {
        if (!this.isInitialized) throw new Error("Engine chưa khởi tạo");

        const rawPhonemes = VietnameseG2P.textToPhonemes(text, this.symbolToId, this.viLangId);
        const { phonemes, tones, languages } = VietnameseG2P.addBlanks(rawPhonemes, this.viLangId);

        const seqLen = phonemes.length;

        const inputs = {
            phone_ids: new Tensor('int64', BigInt64Array.from(phonemes.map(BigInt)), [1, seqLen]),
            phone_lengths: new Tensor('int64', BigInt64Array.from([BigInt(seqLen)]), [1]),
            tone_ids: new Tensor('int64', BigInt64Array.from(tones.map(BigInt)), [1, seqLen]),
            language_ids: new Tensor('int64', BigInt64Array.from(languages.map(BigInt)), [1, seqLen]),
            bert: new Tensor('float32', new Float32Array(1024 * seqLen), [1, 1024, seqLen]),
            ja_bert: new Tensor('float32', new Float32Array(768 * seqLen), [1, 768, seqLen]),
            speaker_id: new Tensor('int64', BigInt64Array.from([BigInt(speakerId)]), [1])
        };

        // --- EXECUTION ---
        // GĐ 1: Encoder
        const encOut = await this.sessions.textEncoder.run(inputs);
        // console.log("Encoder Output (encOut):", encOut); // Debugging: Xem lại cấu trúc này
        // console.log("Keys of encOut:", Object.keys(encOut)); // -> ["logs_p", "x_mask", "x_encoded", "m_p", "g"]

        // GĐ 2: Predict Duration
        const dpOut = await this.sessions.durationPredictor.run({
            x: encOut.x_encoded, // encResult[0] Kotlin
            x_mask: encOut.x_mask, // encResult[3] Kotlin
            g: encOut.g // encResult[4] Kotlin
        });

        // console.log("Duration Predictor Output (dpOut):", dpOut); // Debugging: Xem lại cấu trúc này
        // console.log("Keys of dpOut:", Object.keys(dpOut)); // -> ["logw"]

        // 3. Tính toán Duration (Logic tương đương Kotlin)
        const logw = dpOut.logw.data as Float32Array; // dpResult[0] Kotlin
        const xMask = encOut.x_mask.data as Float32Array; // xMaskTensor (encResult[3] Kotlin)
        let totalFrames = 0;
        const durations = phonemes.map((_, i) => {
            const d = Math.ceil(Math.exp(logw[i]) * xMask[i] * lengthScale);
            totalFrames += d;
            return d;
        });

        // 4. Expand m_p và logs_p (Phần xử lý mảng nặng nhất)
        const channels = encOut.m_p.dims[1]; // mPTensor (encResult[1] Kotlin)
        const m_p = encOut.m_p.data as Float32Array; // mPTensor (encResult[1] Kotlin)
        const logs_p = encOut.logs_p.data as Float32Array; // logsPTensor (encResult[2] Kotlin)

        const expandedMp = new Float32Array(channels * totalFrames);
        const expandedLogsP = new Float32Array(channels * totalFrames);

        let fIdx = 0;
        for (let t = 0; t < seqLen; t++) {
            for (let d = 0; d < durations[t]; d++) {
                if (fIdx < totalFrames) {
                    for (let c = 0; c < channels; c++) {
                        expandedMp[c * totalFrames + fIdx] = m_p[c * seqLen + t];
                        expandedLogsP[c * totalFrames + fIdx] = logs_p[c * seqLen + t];
                    }
                    fIdx++;
                }
            }
        }

        // 5. Sample Z_P (Gaussian Noise)
        const zPData = new Float32Array(channels * totalFrames);
        for (let i = 0; i < zPData.length; i++) {
            const u1 = Math.random();
            const u2 = Math.random();
            const randNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            zPData[i] = expandedMp[i] + Math.exp(expandedLogsP[i]) * randNormal * noiseScale;
        }

        // GĐ 3: Flow
        const flowIn = {
            z_p: new Tensor('float32', zPData, [1, channels, totalFrames]),
            y_mask: new Tensor('float32', new Float32Array(totalFrames).fill(1), [1, 1, totalFrames]),
            g: encOut.g // encResult[4] Kotlin
        };
        const flowOut = await this.sessions.flow.run(flowIn);
        // console.log("Flow Output (flowOut):", flowOut); // Debugging: Xem lại cấu trúc này
        // console.log("Keys of flowOut:", Object.keys(flowOut)); // Xác định tên output cho 'z'

        // GĐ 4: Decoder (Kết quả cuối cùng)
        // Giả sử output đầu tiên của mô hình flow có tên là 'z' (cần xác nhận bằng log/Netron)
        const decOut = await this.sessions.decoder.run({
            z: flowOut.z, // flowResult[0] Kotlin. Thay 'z' bằng tên output thực tế của flow.onnx
            g: encOut.g // encResult[4] Kotlin
        });
        // console.log("Decoder Output (decOut):", decOut); // Debugging: Xem lại cấu trúc này
        // console.log("Keys of decOut:", Object.keys(decOut)); // Xác định tên output cho audio

        // Giả sử output audio của mô hình decoder có tên là 'audio' (cần xác nhận bằng log/Netron)
        return (decOut.audio || decOut.output_0).data as Float32Array; // decResult[0] Kotlin. Dùng fallback nếu tên không rõ
    }
}

