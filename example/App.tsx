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

import { ValtecTTSEngine, splitTextIntoChunks, TextChunk } from 'valtec-tts';

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
    (async () => {
      try {
        const engine = new ValtecTTSEngine();
        await engine.initialize();
        engineRef.current = engine;
        setReady(true);
      } catch (e: any) {
        console.error(e);
        Alert.alert('Lỗi', e?.message ?? 'Không khởi tạo được TTS');
      }
    })();

    return () => {
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

    try {
      const chunks: TextChunk[] = splitTextIntoChunks(text, 10);
      const buffers: Float32Array[] = [];

      for (const c of chunks) {
        if (c.text) {
          const audio = await engineRef.current.synthesize(c.text, speakerId);
          buffers.push(audio);
        }
        if (c.addSilenceAfter > 0) {
          buffers.push(new Float32Array(24000 * c.addSilenceAfter));
        }
      }

      const total = buffers.reduce((s, b) => s + b.length, 0);
      const out = new Float32Array(total);
      let off = 0;
      for (const b of buffers) {
        out.set(b, off);
        off += b.length;
      }

      await play(out);
    } finally {
      setProcessing(false);
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

      {/* PLAY BUTTON */}
      <TouchableOpacity
        style={[styles.mainButton, (!ready || processing) && styles.buttonDisabled]}
        disabled={!ready || processing}
        onPress={speak}
      >
        {processing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.mainButtonText}>
            {ready ? 'Phát Tiếng Nói' : 'Đang tải Model...'}
          </Text>
        )}
      </TouchableOpacity>

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
});