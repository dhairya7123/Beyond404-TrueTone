import onnxruntime as ort

try:
    # Load the ONNX model
    session = ort.InferenceSession("model.onnx")

    print("=== MODEL INPUT DETAILS ===")
    for i in session.get_inputs():
        print(f"Input Name: {i.name}")
        print(f"Input Shape: {i.shape}")
        print(f"Input Type:  {i.type}")

    print("\n=== MODEL OUTPUT DETAILS ===")
    for o in session.get_outputs():
        print(f"Output Name: {o.name}")
        print(f"Output Shape: {o.shape}")
        print(f"Output Type:  {o.type}")

except Exception as e:
    print(f"Error loading model: {e}")