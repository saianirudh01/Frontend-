import React, { useState, useEffect } from "react";
import { View, Button, Text, Alert } from "react-native";
import { Audio } from "expo-av";

export default function AudioRecorder({
  onRecordingFinished,
}: {
  onRecordingFinished: (uri: string) => void;
}) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  useEffect(() => {
    // Ask for permission on mount
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access microphone is required!");
      }
    })();

    return () => {
      sound?.unloadAsync();
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log("Starting recording...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();

      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      };

      await newRecording.prepareToRecordAsync(recordingOptions);
      await newRecording.startAsync();

      setRecording(newRecording);
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  const stopRecording = async () => {
    console.log("Stopping recording...");
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log("Recording stopped and stored at:", uri);

      setRecording(null);
      setIsRecording(false);
      setRecordingUri(uri);
      if (uri) onRecordingFinished(uri);
    } catch (err) {
      console.error("Error stopping recording:", err);
    }
  };

  const playRecording = async () => {
    if (!recordingUri) return;
    try {
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: recordingUri });
      setSound(newSound);
      await newSound.playAsync();
    } catch (err) {
      console.error("Error playing sound:", err);
    }
  };

  return (
    <View
      style={{
        marginVertical: 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 16, marginBottom: 10 }}>
        🎙️ {isRecording ? "Recording..." : "Press Record to Start"}
      </Text>

      {!isRecording ? (
        <Button title="Start Recording" onPress={startRecording} />
      ) : (
        <Button title="Stop Recording" onPress={stopRecording} color="red" />
      )}

      {recordingUri && (
        <View style={{ marginTop: 20 }}>
          <Button title="Play Recording" onPress={playRecording} />
        </View>
      )}
    </View>
  );
}
