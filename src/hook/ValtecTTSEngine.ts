// Placeholder imports
import {
    InferenceSession,
    Tensor,
    env,
} from 'onnxruntime-react-native';
import { Buffer } from 'buffer'; // Import Buffer
import { Asset } from 'expo-asset'; // Sử dụng Expo Asset
import RNFS from 'react-native-fs'; // Import react-native-fs
import { VietnameseG2P } from './VietnameseG2P'; // Cần tự chuyển đổi lớp này
import { Platform } from 'react-native'; // Import Platform

class ValtecTTSEngine {
    static TAG = 'ValtecTTSEngine';
    static SAMPLE_RATE = 24000;

    // Thay đổi thành Map để quản lý các session dễ dàng hơn
    private sessions: {
        textEncoder?: InferenceSession;
        durationPredictor?: InferenceSession;
        flow?: InferenceSession;
        decoder?: InferenceSession;
    } = {};

    private symbolToId = new Map<string, number>();
    private viLangId = 7;
    private g2p = new VietnameseG2P();

    isInitialized = false;

    constructor() {
        console.log("ValtecTTSEngine constructor started. (No env config here)");
        console.log("ValtecTTSEngine constructor finished.");
    }

    async initialize() {
        console.log('[TTS] initialize() START');

        try {
            // Đảm bảo NativeModules.Onnxruntime có sẵn.
            // Điều này thường được xử lý bởi thư viện onnxruntime-react-native khi được khởi tạo.
            // Các log kiểm tra NativeModules có thể hữu ích cho debug ban đầu nhưng không cần thiết mỗi lần initialize.
            // if (!NativeModules.Onnxruntime) {
            //     throw new Error('[TTS] NativeModules.Onnxruntime = null ❌ (native chưa load)');
            // }

            // Always set logLevel first, as it's often used during the initial native setup.
            env.logLevel = 'verbose';
            console.log("ONNX Runtime env.logLevel configured.");

            // First, load configuration
            await this.loadConfig();

            const options: InferenceSession.SessionOptions = {
                graphOptimizationLevel: 'basic',
                // Sử dụng executionProviders từ cách cũ của bạn
                executionProviders:
                    Platform.OS === 'ios'
                        ? ['coreml', 'cpu'] // CoreML là một lựa chọn tốt cho iOS
                        : ['nnapi', 'cpu'], // NNAPI là một lựa chọn tốt cho Android
            };

            console.log(ValtecTTSEngine.TAG, 'Loading ONNX models...');
            console.log('[TTS] ORT options:', options);

            // The env.wasm configuration is specific to onnxruntime-web (browser WASM).
            // onnxruntime-react-native uses native modules, so env.wasm will likely be undefined
            // or irrelevant. We remove this block for standard React Native native execution.
            // if (env.wasm) {
            //     console.log("Accessing env.wasm AFTER first model load:", env.wasm);
            //     env.wasm.proxy = true;
            //     env.wasm.numThreads = 1;
            //     console.log("ONNX Runtime env.wasm properties configured.");
            // } else {
            //     console.warn("env.wasm is undefined after first model load. WASM-specific configuration skipped.");
            // }

            // Load models using the readAsset helper function
            this.sessions.textEncoder = await this.loadModel('text_encoder.onnx', options, require('../../model/text_encoder.onnx'));
            console.log(ValtecTTSEngine.TAG, '  ✓ text_encoder');

            this.sessions.durationPredictor = await this.loadModel('duration_predictor.onnx', options, require('../../model/duration_predictor.onnx'));
            console.log(ValtecTTSEngine.TAG, '  ✓ duration_predictor');

            this.sessions.flow = await this.loadModel('flow.onnx', options, require('../../model/flow.onnx'));
            console.log(ValtecTTSEngine.TAG, '  ✓ flow');

            this.sessions.decoder = await this.loadModel('decoder.onnx', options, require('../../model/decoder.onnx'));
            console.log(ValtecTTSEngine.TAG, '  ✓ decoder');

            this.isInitialized = true;
            console.log(ValtecTTSEngine.TAG, 'All models loaded successfully');
            console.log('[TTS] initialize() SUCCESS ✅');
        } catch (e: any) {
            console.error(ValtecTTSEngine.TAG, `Init failed: ${e.message}`, e);
            console.error('[TTS] initialize() FAILED ❌');
            console.error('[TTS] Error message:', e?.message);
            console.error('[TTS] Full error:', e);
            throw e;
        }
    }

    async loadConfig() {
        console.log('[TTS] Loading tts_config.json');
        try {
            // Sử dụng require trực tiếp cho tệp JSON để Metro Bundler xử lý
            const config = require('../../model/tts_config.json');
            console.log('[TTS] Config loaded OK');

            // Đối với JavaScript, việc xử lý kiểu dữ liệu từ JSON thường đơn giản hơn
            // Chuyển đổi object thành Map
            this.symbolToId = new Map(Object.entries(config.symbol_to_id).map(([key, value]) => [key, parseInt(value as string)]));
            this.viLangId = parseInt(config.language_id_map['VI'] as string) || 7;

            // Giả định g2p.initialize đã được chuyển đổi để chấp nhận Map hoặc Object.
            this.g2p.initialize(this.symbolToId, this.viLangId);
            console.log(ValtecTTSEngine.TAG, `Config loaded: ${this.symbolToId.size} symbols`);
        } catch (error: any) {
            console.error(ValtecTTSEngine.TAG, `Failed to load config: ${error.message}`, error);
            throw error;
        }
    }

    async loadModel(fileName: string, options: InferenceSession.SessionOptions, assetModule: any): Promise<InferenceSession> {
        console.log(`[TTS] Reading asset for ${fileName}`);
        try {
            const asset = Asset.fromModule(assetModule);
            // console.log(`[TTS] Asset info (${fileName}):`, asset); // Log chi tiết asset nếu cần debug

            if (!asset.localUri) {
                console.log(`[TTS] Downloading asset: ${fileName}`);
                await asset.downloadAsync();
            }

            if (!asset.localUri) {
                throw new Error(`[TTS] asset.localUri null: ${fileName}`);
            }

            console.log(`[TTS] Reading file from: ${asset.localUri}`);
            const base64 = await RNFS.readFile(asset.localUri, 'base64');

            console.log(
                `[TTS] ${fileName} size (base64 chars):`,
                base64.length
            );

            const modelBuffer = Buffer.from(base64, 'base64');
            return await InferenceSession.create(modelBuffer, options);
        } catch (error: any) {
            console.error(ValtecTTSEngine.TAG, `Failed to load model ${fileName}: ${error.message}`, error);
            throw error;
        }
    }

    // Hàm tạo số ngẫu nhiên Gaussian (bình thường), cần một thư viện bên ngoài
    // hoặc triển khai thủ công nếu Math.random() không đủ.
    gaussianRandom(rand: { random: () => number }): number {
        // Sử dụng Box-Muller transform
        let u = 0, v = 0;
        while (u === 0) u = rand.random(); // Converting [0,1) to (0,1)
        while (v === 0) v = rand.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    async synthesize(
        text: string,
        speakerId = 1,
        noiseScale = 0.667,
        lengthScale = 1.0
    ): Promise<Float32Array> {
        if (!this.isInitialized) throw new Error('Not initialized');

        console.log(ValtecTTSEngine.TAG, `Synthesizing: "${text}"`);

        // Chuyển đổi G2P
        const { phonemes, tones, languages } = this.g2p.textToPhonemes(text);
        console.log(ValtecTTSEngine.TAG, 'Phonemes:', phonemes);
        console.log(ValtecTTSEngine.TAG, 'Tones:', tones);
        const { phonemes: pBlanks, tones: tBlanks, languages: lBlanks } = this.g2p.addBlanks(phonemes, tones, languages);
        const seqLen = pBlanks.length;
        console.log(ValtecTTSEngine.TAG, `Phonemes with blanks: ${seqLen}, first 20: ${pBlanks.slice(0, 20)}`);

        // Tạo các Tensor đầu vào
        const phoneIds = new Tensor('int64', BigInt64Array.from(pBlanks.map(v => BigInt(v))), [1, seqLen]);
        const phoneLengths = new Tensor('int64', BigInt64Array.from([BigInt(seqLen)]), [1]);
        const toneIds = new Tensor('int64', BigInt64Array.from(tBlanks.map(v => BigInt(v))), [1, seqLen]);
        const languageIds = new Tensor('int64', BigInt64Array.from(lBlanks.map(v => BigInt(v))), [1, seqLen]);
        const bert = new Tensor('float32', new Float32Array(1024 * seqLen).fill(0), [1, 1024, seqLen]);
        const jaBert = new Tensor('float32', new Float32Array(768 * seqLen).fill(0), [1, 768, seqLen]);
        const sid = new Tensor('int64', BigInt64Array.from([BigInt(speakerId)]), [1]);

        try {
            // Text encoder
            const encInputs = {
                'phone_ids': phoneIds,
                'phone_lengths': phoneLengths,
                'tone_ids': toneIds,
                'language_ids': languageIds,
                'bert': bert,
                'ja_bert': jaBert,
                'speaker_id': sid,
            };
            console.log(ValtecTTSEngine.TAG, 'Running text encoder...');
            // Đảm bảo this.sessions.textEncoder không null trước khi gọi run
            if (!this.sessions.textEncoder) throw new Error("Text encoder not initialized.");
            const encResult = await this.sessions.textEncoder.run(encInputs);

            // Cần kiểm tra tên output thực tế của mô hình ONNX. Ví dụ:
            // const mPTensor = encResult.m_p as Tensor;
            // const logsPTensor = encResult.logs_p as Tensor;
            // const xMaskTensor = encResult.x_mask as Tensor;
            // const gTensor = encResult.g as Tensor;

            // Giả định tên output như ví dụ trước:
            const mPTensor = encResult['output_mp'] as Tensor; // Sửa lại tên output nếu cần
            const logsPTensor = encResult['output_logsp'] as Tensor; // Sửa lại tên output nếu cần
            const xMaskTensor = encResult['output_xmask'] as Tensor; // Sửa lại tên output nếu cần
            const gTensor = encResult['output_g'] as Tensor; // Sửa lại tên output nếu cần

            // Dựa trên cách cũ của bạn, output có vẻ là:
            const x_encoded = encResult['x_encoded'] as Tensor;
            const x_mask = encResult['x_mask'] as Tensor;
            const g = encResult['g'] as Tensor;
            const m_p = encResult['m_p'] as Tensor;
            const logs_p = encResult['logs_p'] as Tensor;

            const channels = m_p.dims[1]; // Giả sử shape là [batch, channels, seqLen]

            // Duration predictor
            const dpInputs = {
                'x': x_encoded,
                'x_mask': x_mask,
                'g': g,
            };
            console.log(ValtecTTSEngine.TAG, 'Running duration predictor...');
            if (!this.sessions.durationPredictor) throw new Error("Duration predictor not initialized.");
            const dpResult = await this.sessions.durationPredictor.run(dpInputs);

            const logwTensor = dpResult['logw'] as Tensor; // Sửa lại tên output nếu cần
            const logwData = logwTensor.data as Float32Array; // TypedArray
            const xMaskData = x_mask.data as Float32Array; // Sử dụng x_mask từ encResult

            // Compute durations
            let totalFrames = 0;
            const durations = new Int32Array(seqLen);
            for (let t = 0; t < seqLen; t++) {
                const dur = Math.ceil(Math.exp(logwData[t]) * xMaskData[t] * lengthScale);
                durations[t] = dur;
                totalFrames += dur;
            }
            if (totalFrames === 0) totalFrames = 1;
            console.log(ValtecTTSEngine.TAG, `Total frames: ${totalFrames}`);

            // Expand m_p and logs_p
            const mPData = m_p.data as Float32Array;
            const logsPData = logs_p.data as Float32Array;
            const expandedMp = new Float32Array(channels * totalFrames);
            const expandedLogsP = new Float32Array(channels * totalFrames);

            let fIdx = 0;
            for (let t = 0; t < seqLen; t++) {
                for (let d = 0; d < durations[t]; d++) {
                    if (fIdx < totalFrames) {
                        for (let c = 0; c < channels; c++) {
                            expandedMp[c * totalFrames + fIdx] = mPData[c * seqLen + t];
                            expandedLogsP[c * totalFrames + fIdx] = logsPData[c * seqLen + t];
                        }
                        fIdx++;
                    }
                }
            }

            // Sample z_p
            // Nếu bạn muốn sử dụng `seedrandom`, bạn cần import nó và thay thế `Math.random()`
            const rand = { random: () => Math.random() }; // Sử dụng Math.random() mặc định
            const zPData = new Float32Array(channels * totalFrames);
            for (let i = 0; i < channels * totalFrames; i++) {
                zPData[i] = expandedMp[i] + Math.exp(expandedLogsP[i]) * this.gaussianRandom(rand) * noiseScale;
            }

            const zPTensor = new Tensor('float32', zPData, [1, channels, totalFrames]);
            const yMask = new Tensor('float32', new Float32Array(totalFrames).fill(1.0), [1, 1, totalFrames]);

            // Flow
            const flowInputs = { 'z_p': zPTensor, 'y_mask': yMask, 'g': g }; // Sử dụng 'g' từ encResult
            console.log(ValtecTTSEngine.TAG, 'Running flow...');
            if (!this.sessions.flow) throw new Error("Flow model not initialized.");
            const flowResult = await this.sessions.flow.run(flowInputs);

            const zOutput = flowResult['z'] as Tensor; // Sửa lại tên output nếu cần

            // Decoder
            const decInputs = { 'z': zOutput, 'g': g }; // Sử dụng 'g' từ encResult
            console.log(ValtecTTSEngine.TAG, 'Running decoder...');
            if (!this.sessions.decoder) throw new Error("Decoder model not initialized.");
            const decResult = await this.sessions.decoder.run(decInputs);

            // Extract audio
            const audioTensor = (decResult['audio'] || decResult['output_0']) as Tensor; // Sửa lại tên output nếu cần, dùng fallback
            const audio = audioTensor.data as Float32Array; // Float32Array

            console.log(ValtecTTSEngine.TAG, `Generated ${audio.length} samples`);
            return audio;

        } finally {
            // Đảm bảo dispose các tensor được tạo trong synthesize
            phoneIds.dispose();
            phoneLengths.dispose();
            toneIds.dispose();
            languageIds.dispose();
            bert.dispose();
            jaBert.dispose();
            sid.dispose();
            // Các tensor trung gian như x_encoded, x_mask, g, m_p, logs_p được trả về từ run()
            // và cần được dispose nếu không được giữ lại hoặc sử dụng lại một cách cẩn thận.
            // Trong trường hợp này, chúng được dùng và không được lưu trữ lâu dài,
            // nhưng nếu bạn muốn chắc chắn về quản lý bộ nhớ, bạn có thể gọi .dispose() trên chúng.
            // Ví dụ: encResult.x_encoded.dispose();
        }
    }

    async close(): Promise<void> {
        // Trong onnxruntime-react-native, phiên InferenceSession cần được released rõ ràng
        if (this.sessions.textEncoder) await this.sessions.textEncoder.release();
        if (this.sessions.durationPredictor) await this.sessions.durationPredictor.release();
        if (this.sessions.flow) await this.sessions.flow.release();
        if (this.sessions.decoder) await this.sessions.decoder.release();
        // Không có `ortEnvironment.close()` tương đương trong JS API
        this.isInitialized = false;
        this.sessions = {}; // Xóa các tham chiếu session
    }
}

export default ValtecTTSEngine;

