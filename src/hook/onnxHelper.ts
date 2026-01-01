import { InferenceSession, Tensor } from 'onnxruntime-react-native';

/**
 * Thay thế cho OnnxHelper.java
 * Trong JS, chúng ta không cần ép kiểu OnnxTensorLike phức tạp như Java.
 */
export const runOnnxInference = async (
  session: InferenceSession, 
  inputData: Record<string, Tensor> // Tương đương Map<String, OnnxTensor>
): Promise<InferenceSession.ReturnType> => {
  try {
    // Session.run trong JS nhận vào một Object với key là tên input
    // và value là đối tượng Tensor.
    const results = await session.run(inputData);
    return results;
  } catch (e) {
    console.error("Lỗi khi chạy ONNX inference:", e);
    throw e;
  }
};