import React, { useState } from "react";
import { View, Button, Image, Text, Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";


interface MediaPickerProps {
  onMediaPicked: (uri: string, type: "image" | "video") => void;
}

export default function MediaPicker({ onMediaPicked }: MediaPickerProps) {
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Sorry, we need camera roll permissions to make this work!");
      return false;
    }

    const camStatus = await ImagePicker.requestCameraPermissionsAsync();
    if (camStatus.status !== "granted") {
      Alert.alert("Camera permission is required!");
      return false;
    }

    return true;
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      const type = asset.type === "video" ? "video" : "image";
      setMediaType(type);
      onMediaPicked(asset.uri, type);
    }
  };

  const captureWithCamera = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      const type = asset.type === "video" ? "video" : "image";
      setMediaType(type);
      onMediaPicked(asset.uri, type);
    }
  };

  return (
    <View style={{ alignItems: "center", marginVertical: 20 }}>
      <Text style={{ fontSize: 16, marginBottom: 10 }}>📸 Pick or Capture Media</Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Gallery" onPress={pickFromGallery} />
        <Button title="Camera" onPress={captureWithCamera} />
      </View>

      {mediaUri && (
        <View style={{ marginTop: 20 }}>
          {mediaType === "image" ? (
            <Image
              source={{ uri: mediaUri }}
              style={{ width: 250, height: 250, borderRadius: 10 }}
              resizeMode="cover"
            />
          ) : (
            <Video
              source={{ uri: mediaUri }}
              style={{ width: 300, height: 200, borderRadius: 10 }}
              useNativeControls
              // Use expo-av provided constants (typed)
              resizeMode={Platform.OS === "ios" ? ResizeMode.COVER : ResizeMode.CONTAIN}

            />
          )}
        </View>
      )}
    </View>
  );
}
