// Placeholder imports
import {
    InferenceSession,
    Tensor,
    env,
} from 'onnxruntime-react-native';
import { Buffer } from 'buffer'; // Import Buffer
import { Asset } from 'expo-asset'; // Sử dụng Expo Asset
import RNFS from 'react-native-fs'; // Import react-native-fs
import { Platform } from 'react-native'; // Import Platform
import VietnameseG2P from './vietnamese_g2p.js' // Giả định VietnameseG2P.js được port đúng


interface TtsConfig {
    symbol_to_id: { [key: string]: number };
    language_id_map: { [key: string]: number };
    sample_rate: number;
    // Thêm các thuộc tính khác từ tts_config.json nếu cần
}

class ValtecTTSEngine {
    static TAG = 'ValtecTTSEngine';
    static SAMPLE_RATE = 24000; // Default sample rate, will be updated from config

    private sessions: {
        textEncoder?: InferenceSession;
        durationPredictor?: InferenceSession;
        flow?: InferenceSession;
        decoder?: InferenceSession;
    } = {};

    private ttsConfig: TtsConfig | null = null;
    // Removed: private g2p: VietnameseG2P; // Không còn khởi tạo instance

    isInitialized = false;

    constructor() {
    }

    async initialize(): Promise<void> {

        try {
            // Configure ONNX Runtime environment
            env.logLevel = 'verbose';

            // Load configuration first
            await this.loadConfig();
            if (!this.ttsConfig) {
                throw new Error("TTS config not loaded.");
            }
            
            ValtecTTSEngine.SAMPLE_RATE = this.ttsConfig.sample_rate;

            const options: InferenceSession.SessionOptions = {
                graphOptimizationLevel: 'basic',
                executionProviders: ['cpu']
            };

            this.sessions.textEncoder = await this.loadModel('text_encoder.onnx', options, require('../../model/text_encoder.onnx'));
            this.sessions.durationPredictor = await this.loadModel('duration_predictor.onnx', options, require('../../model/duration_predictor.onnx'));
            this.sessions.flow = await this.loadModel('flow.onnx', options, require('../../model/flow.onnx'));
            this.sessions.decoder = await this.loadModel('decoder.onnx', options, require('../../model/decoder.onnx'));
            this.isInitialized = true;
        } catch (e: any) {
            throw e;
        }
    }

    async loadConfig(): Promise<void> {
        try {
            const config = require('../../model/tts_config.json');
            this.ttsConfig = config as TtsConfig;

            // Removed: G2P initialization as it uses static methods and doesn't need explicit initialization.
        } catch (error: any) {
            throw error;
        }
    }

    async loadModel(fileName: string, options: InferenceSession.SessionOptions, assetModule: any): Promise<InferenceSession> {
        try {
            const asset = Asset.fromModule(assetModule);

            if (!asset.localUri) {
                await asset.downloadAsync();
            }

            if (!asset.localUri) {
                throw new Error(`[TTS] asset.localUri is null for: ${fileName}`);
            }

            const base64 = await RNFS.readFile(asset.localUri.replace('file://', ''), 'base64');

            const modelBuffer = Buffer.from(base64, 'base64');
            return await InferenceSession.create(modelBuffer, options);
        } catch (error: any) {
            throw error;
        }
    }

    // Removed: gaussianRandom() method, as noise generation will use uniform random.

    async synthesize(
        text: string,
        speakerId = 1,
        noiseScale = 0.667,
        lengthScale = 1.0 // This parameter will be ignored or set to 1.0 as per web version
    ): Promise<Float32Array> {
        if (!this.isInitialized || !this.ttsConfig) throw new Error('TTS Engine not initialized or config missing.');


        const g2pResult = VietnameseG2P.textToPhonemes(text, this.ttsConfig.symbol_to_id, this.ttsConfig.language_id_map['VI']);
        const { phonemes, tones, languages } = VietnameseG2P.addBlanks(g2pResult, this.ttsConfig.language_id_map['VI']);

        const seqLen = phonemes.length;

        const phoneIds = new Tensor('int64', BigInt64Array.from(phonemes.map(v => BigInt(v))), [1, seqLen]);
        const phoneLengths = new Tensor('int64', BigInt64Array.from([BigInt(seqLen)]), [1]);
        const toneIds = new Tensor('int64', BigInt64Array.from(tones.map(v => BigInt(v))), [1, seqLen]);
        const languageIds = new Tensor('int64', BigInt64Array.from(languages.map(v => BigInt(v))), [1, seqLen]);

        const bert = new Tensor('float32', new Float32Array(1024 * seqLen).fill(0), [1, 1024, seqLen]);
        const jaBert = new Tensor('float32', new Float32Array(768 * seqLen).fill(0), [1, 768, seqLen]);
        const sid = new Tensor('int64', BigInt64Array.from([BigInt(speakerId)]), [1]);

        let x_encoded: Tensor | undefined;
        let x_mask: Tensor | undefined;
        let g: Tensor | undefined;
        let m_p: Tensor | undefined;
        let logs_p: Tensor | undefined;
        let logw: Tensor | undefined;
        let z_output: Tensor | undefined;

        try {
            if (!this.sessions.textEncoder) throw new Error("Text encoder not initialized.");
            const encInputs = {
                phone_ids: phoneIds,
                phone_lengths: phoneLengths,
                tone_ids: toneIds,
                language_ids: languageIds,
                bert: bert,
                ja_bert: jaBert,
                speaker_id: sid
            };
            const encOutputs = await this.sessions.textEncoder.run(encInputs);

            x_encoded = encOutputs.x_encoded as Tensor;
            m_p = encOutputs.m_p as Tensor;
            logs_p = encOutputs.logs_p as Tensor;
            x_mask = encOutputs.x_mask as Tensor;
            g = encOutputs.g as Tensor;

            if (!x_encoded || !m_p || !logs_p || !x_mask || !g) {
                throw new Error("Text encoder did not return all expected outputs.");
            }

            const channels = m_p.dims[1];

            // Step 3: Duration prediction
            if (!this.sessions.durationPredictor) throw new Error("Duration predictor not initialized.");
            const dpInputs = {
                x: x_encoded,
                x_mask: x_mask,
                g: g
            };
            const dpOutputs = await this.sessions.durationPredictor.run(dpInputs);

            logw = dpOutputs.logw as Tensor;
            if (!logw) {
                throw new Error("Duration predictor did not return logw output.");
            }

            // Compute durations and expand - lengthScale removed or set to 1.0 as per web version
            const logwData = logw.data as Float32Array;
            const maskData = x_mask.data as Float32Array;
            let totalFrames = 0;
            const durations = new Int32Array(seqLen);

            for (let i = 0; i < logwData.length; i++) {
                // lengthScale removed here (effectively 1.0)
                const dur = Math.ceil(Math.exp(logwData[i]) * maskData[i]);
                durations[i] = dur;
                totalFrames += dur;
            }
            if (totalFrames === 0) totalFrames = 1;

            // Expand m_p and logs_p according to durations
            const mPData = m_p.data as Float32Array;
            const logsPData = logs_p.data as Float32Array;
            const expandedMP = new Float32Array(channels * totalFrames);
            const expandedLogsP = new Float32Array(channels * totalFrames);

            let frameIdx = 0;
            for (let t = 0; t < durations.length; t++) {
                for (let d = 0; d < durations[t]; d++) {
                    if (frameIdx < totalFrames) {
                        for (let c = 0; c < channels; c++) {
                            expandedMP[c * totalFrames + frameIdx] = mPData[c * seqLen + t];
                            expandedLogsP[c * totalFrames + frameIdx] = logsPData[c * seqLen + t];
                        }
                        frameIdx++;
                    }
                }
            }

            // Sample z_p (noise generation using uniform random)
            const zPData = new Float32Array(channels * totalFrames);
            for (let i = 0; i < channels * totalFrames; i++) {
                const noise = (Math.random() * 2 - 1) * noiseScale; // Uniform random noise
                zPData[i] = expandedMP[i] + Math.exp(expandedLogsP[i]) * noise;
            }

            const zPTensor = new Tensor('float32', zPData, [1, channels, totalFrames]);
            const yMask = new Tensor('float32', new Float32Array(totalFrames).fill(1.0), [1, 1, totalFrames]);

            if (!this.sessions.flow) throw new Error("Flow model not initialized.");
            const flowInputs = { z_p: zPTensor, y_mask: yMask, g: g };
            const flowOutputs = await this.sessions.flow.run(flowInputs);

            z_output = flowOutputs.z as Tensor;
            if (!z_output) {
                throw new Error("Flow model did not return z output.");
            }

            // Decode to audio
            if (!this.sessions.decoder) throw new Error("Decoder model not initialized.");
            const decInputs = { z: z_output, g: g };
            const decOutputs = await this.sessions.decoder.run(decInputs);

            const audioTensor = (decOutputs.audio || decOutputs.output_0) as Tensor;
            if (!audioTensor) {
                throw new Error("Decoder did not return audio output.");
            }
            const audio = audioTensor.data as Float32Array;

            return audio;

        } catch (error) {
            throw error;
        } finally {
            // Tensors are garbage collected
        }
    }

    async close(): Promise<void> {
        if (this.sessions.textEncoder) await this.sessions.textEncoder.release();
        if (this.sessions.durationPredictor) await this.sessions.durationPredictor.release();
        if (this.sessions.flow) await this.sessions.flow.release();
        if (this.sessions.decoder) await this.sessions.decoder.release();
        this.isInitialized = false;
        this.sessions = {};
    }
}

export default ValtecTTSEngine;

