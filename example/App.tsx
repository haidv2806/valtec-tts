import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';

import ValtecTTSEngine, { splitTextIntoChunks, TextChunk } from 'valtec-tts';

/* ================= WAV HELPERS ================= */

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function createWavFile(audioData: Float32Array, sampleRate = 24000): string {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockSize = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockSize;
  const dataLength = audioData.length * bytesPerSample;
  const fileLength = 36 + dataLength;

  const buffer = new ArrayBuffer(fileLength + 8);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockSize, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < audioData.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, audioData[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
  }

  return `data:audio/wav;base64,${arrayBufferToBase64(buffer)}`;
}

/* ================= APP ================= */

export default function App() {
  const [text, setText] = useState(
    'Nắng khẽ vương trên những nụ hoa. Gió hát bài ca.\nMùa xuân đến rồi.'
  );
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [speakerId, setSpeakerId] = useState(1);
  const [noiseScale, setNoiseScale] = useState(0.667);
  const [lengthScale, setLengthScale] = useState(1.0);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [generationStats, setGenerationStats] = useState<{
    time: number;
    audioDuration: number;
    rtf: number;
    charCount: number;
  } | null>(null);

  const engineRef = useRef<ValtecTTSEngine | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const speakers = [
    { id: 0, name: 'Giọng 0' },
    { id: 1, name: 'Giọng 1' },
    { id: 2, name: 'Giọng 2' },
    { id: 3, name: 'Giọng 3' },
    { id: 4, name: 'Giọng 4' },
  ];

  useEffect(() => {
    engineRef.current = new ValtecTTSEngine();
    return () => {
      engineRef.current?.close();
      soundRef.current?.unloadAsync();
    };
  }, []);

  const play = async (pcm: Float32Array) => {
    const uri = createWavFile(pcm, 24000);
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    soundRef.current = sound;
  };

  const speak = async () => {
    if (!engineRef.current || !ready) return;
    setProcessing(true);
    setGenerationStats(null);
    const startTime = Date.now();

    try {
      const chunks: TextChunk[] = splitTextIntoChunks(text, 0);
      const buffers: Float32Array[] = [];

      for (const c of chunks) {
        if (c.text) {
          const audio = await engineRef.current.synthesize(
            c.text,
            speakerId,
            noiseScale,
            lengthScale
          );
          buffers.push(audio);
        }
        if (c.addSilenceAfter > 0) {
          buffers.push(new Float32Array(24000 * c.addSilenceAfter));
        }
      }

      const totalSamples = buffers.reduce((s, b) => s + b.length, 0);
      const out = new Float32Array(totalSamples);
      let off = 0;
      for (const b of buffers) {
        out.set(b, off);
        off += b.length;
      }

      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const audioDurationSec = totalSamples / 24000;
      const rtf = durationMs / 1000 / audioDurationSec;

      setGenerationStats({
        time: durationMs,
        audioDuration: audioDurationSec,
        rtf: rtf,
        charCount: text.length,
      });

      await play(out);
    } finally {
      setProcessing(false);
    }
  };

  const initEngine = async () => {
    try {
      if (!engineRef.current) engineRef.current = new ValtecTTSEngine();
      setProcessing(true);
      await engineRef.current.initialize();
      setReady(true);
      Alert.alert('Thành công', 'Engine đã sẵn sàng.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Lỗi', e?.message ?? 'Không khởi tạo được TTS, hãy đảm bảo đã tải mô hình.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadModels = async () => {
    try {
      if (!engineRef.current) engineRef.current = new ValtecTTSEngine();
      setDownloading(true);
      setDownloadProgress(0);
      await engineRef.current.downloadModels((progress, fileName) => {
        setDownloadProgress(progress);
        setCurrentFile(fileName);
      });
      Alert.alert('Thành công', 'Đã tải xong models, bạn có thể khởi tạo.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Lỗi tải', e?.message ?? 'Đã có lỗi trong quá trình tải.');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
      setCurrentFile('');
    }
  };

  const deleteModels = async () => {
    try {
      if (!engineRef.current) return;
      await engineRef.current.deleteModels();
      Alert.alert('Thành công', 'Đã xóa toàn bộ các file model đã tải.');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Lỗi xóa', e?.message ?? 'Đã có lỗi xảy ra.');
    }
  };

  const closeEngine = async () => {
    try {
      if (engineRef.current) {
        await engineRef.current.close();
      }
      setReady(false);
      Alert.alert('Thành công', 'Đã tắt model để giải phóng bộ nhớ.');
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Valtec TTS</Text>
        <Text style={styles.subtitle}>Vietnamese AI Voice</Text>
      </View>

      {/* INPUT */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Nhập văn bản..."
          placeholderTextColor="#666"
        />
      </View>

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        {downloading ? (
          <View style={styles.downloadStatus}>
            <Text style={styles.downloadText}>Đang tải: {currentFile}</Text>
            <Text style={styles.progressText}>{downloadProgress.toFixed(1)}%</Text>
          </View>
        ) : (
          <View style={styles.actionRow}>
            {!ready && (
              <TouchableOpacity style={styles.btnAction} onPress={downloadModels} disabled={processing}>
                <Text style={styles.btnText}>Tải Model</Text>
              </TouchableOpacity>
            )}

            {!ready && (
              <TouchableOpacity style={[styles.btnAction, styles.btnInit]} onPress={initEngine} disabled={processing}>
                {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Khởi tạo TTS</Text>}
              </TouchableOpacity>
            )}

            {ready && (
              <TouchableOpacity style={[styles.btnAction, styles.btnClose]} onPress={closeEngine} disabled={processing}>
                <Text style={styles.btnText}>Tắt Model</Text>
              </TouchableOpacity>
            )}

            {!ready && (
              <TouchableOpacity style={[styles.btnAction, styles.btnDelete]} onPress={deleteModels} disabled={processing}>
                <Text style={styles.btnText}>Xóa Model</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* SPEAKER */}
      <Text style={styles.label}>Chọn giọng đọc:</Text>
      <View style={styles.speakerGrid}>
        {speakers.map(s => (
          <TouchableOpacity
            key={s.id}
            style={[
              styles.speakerButton,
              speakerId === s.id && styles.speakerButtonSelected,
            ]}
            onPress={() => setSpeakerId(s.id)}
          >
            <Text
              style={[
                styles.speakerText,
                speakerId === s.id && styles.speakerTextSelected,
              ]}
            >
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* NOISE SCALE */}
      <Text style={styles.label}>Noise Scale: {noiseScale.toFixed(2)}</Text>
      <View style={styles.adjustRow}>
        <TouchableOpacity style={styles.adjustBtn} onPress={() => setNoiseScale(v => Math.max(0, +(v - 0.05).toFixed(2)))}>
          <Text style={styles.adjustText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjustBtn} onPress={() => setNoiseScale(v => Math.min(1.5, +(v + 0.05).toFixed(2)))}>
          <Text style={styles.adjustText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* LENGTH SCALE */}
      <Text style={styles.label}>Length Scale: {lengthScale.toFixed(2)}</Text>
      <View style={styles.adjustRow}>
        <TouchableOpacity style={styles.adjustBtn} onPress={() => setLengthScale(v => Math.max(0.5, +(v - 0.05).toFixed(2)))}>
          <Text style={styles.adjustText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adjustBtn} onPress={() => setLengthScale(v => Math.min(2.0, +(v + 0.05).toFixed(2)))}>
          <Text style={styles.adjustText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* PLAY BUTTON */}
      <TouchableOpacity
        style={[styles.mainButton, (!ready || processing) && styles.buttonDisabled]}
        disabled={!ready || processing}
        onPress={speak}
      >
        {processing && ready ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.mainButtonText}>
            {ready ? 'Phát Tiếng Nói' : 'Chưa Khởi Tạo'}
          </Text>
        )}
      </TouchableOpacity>

      {/* GENERATION STATS */}
      {generationStats && (
        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>Hiệu suất sinh âm thanh:</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>Xử lý</Text>
              <Text style={styles.statsValue}>{generationStats.time}ms</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>Âm thanh</Text>
              <Text style={styles.statsValue}>{generationStats.audioDuration.toFixed(2)}s</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>RTF</Text>
              <Text style={styles.statsValue}>{generationStats.rtf.toFixed(3)}</Text>
            </View>
            <View style={styles.statsItem}>
              <Text style={styles.statsLabel}>Tốc độ</Text>
              <Text style={styles.statsValue}>
                {Math.round(generationStats.charCount / (generationStats.time / 1000))} ký tự/s
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* INFO */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Thông số:</Text>
        <Text>• Sample Rate: 24,000Hz</Text>
        <Text>• Engine: Valtec AI</Text>
      </View>
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    flexGrow: 1,
  },

  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },

  inputContainer: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    backgroundColor: '#fcfcfc',
    marginBottom: 20,
  },
  input: {
    fontSize: 16,
    color: '#000',
    textAlignVertical: 'top',
  },

  controlPanel: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  downloadStatus: {
    alignItems: 'center',
  },
  downloadText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  btnAction: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    minWidth: '45%',
    alignItems: 'center',
    margin: 4,
  },
  btnInit: {
    backgroundColor: '#34C759',
  },
  btnClose: {
    backgroundColor: '#FF9500',
  },
  btnDelete: {
    backgroundColor: '#FF3B30',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },

  speakerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  speakerButton: {
    width: '48%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    marginBottom: 10,
  },
  speakerButtonSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  speakerText: {
    color: '#555',
    fontWeight: '500',
  },
  speakerTextSelected: {
    color: '#007AFF',
    fontWeight: 'bold',
  },

  mainButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  infoBox: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  infoTitle: {
    fontWeight: '600',
    marginBottom: 6,
  },

  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  adjustBtn: {
    width: '48%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  adjustText: {
    fontSize: 20,
    fontWeight: 'bold',
  },

  statsBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statsItem: {
    width: '24%',
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
});