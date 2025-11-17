import React, { useState } from "react";
import { View, Button, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";

const AudioUploader = ({ onUploadComplete }: { onUploadComplete?: (url: string) => void }) => {
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const uploadAudio = async () => {
    try {
      // Let user pick an audio file from device storage
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const uri = file.uri;
      const name = file.name || "audio.mp3";
      const type = file.mimeType || "audio/mpeg";

      const formData = new FormData();
      formData.append("file", {
        uri,
        name,
        type,
      } as any);

      setUploading(true);

      // Replace this with your actual backend upload URL
      const response = await axios.post("https://your-api-endpoint.com/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const uploadedUrl = response.data.url;

      setFileUrl(uploadedUrl);
      setUploading(false);

      if (onUploadComplete) onUploadComplete(uploadedUrl);

      Alert.alert("✅ Upload successful", "File uploaded successfully!");
    } catch (error: any) {
      console.error("Upload failed:", error);
      Alert.alert("❌ Error", "Failed to upload file.");
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Upload Audio File" onPress={uploadAudio} />
      {uploading && <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 10 }} />}
      {fileUrl && (
        <Text style={styles.urlText}>
          Uploaded URL:
          {"\n"}
          {fileUrl}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    alignItems: "center",
  },
  urlText: {
    marginTop: 10,
    color: "#007AFF",
    fontSize: 14,
    textAlign: "center",
  },
});

export default AudioUploader;
