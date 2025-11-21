import { useState } from "react";
import { StyleSheet, View, TextInput, Button, Image, Alert, TouchableOpacity, Text, ActivityIndicator, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { supabase } from "../lib/supabase";
import { RootStackParamList } from "../navigation/types";

type Navigation = NativeStackNavigationProp<RootStackParamList, "CreatePost">;

export default function CreatePostScreen() {
  const navigation = useNavigation<Navigation>();
  const [content, setContent] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mimeType, setMimeType] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Allow gallery access to upload media.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === "video" ? "video" : "image");
      setMimeType(asset.mimeType);
    }
  };

  const handlePost = async () => {
    if (!content && !mediaUri) {
      Alert.alert("Add something", "Write text or pick media before posting.");
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error(userError?.message ?? "Not authenticated");
      }

      let fileUrl: string | null = null;
      if (mediaUri) {
        const extension = mediaUri.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");
        const fileName = `${user.id}_${Date.now()}.${extension}`;
        const base64 = await FileSystem.readAsStringAsync(mediaUri, { encoding: "base64" });
        const fileData = decode(base64);
        const contentType = mimeType || (mediaType === "video" ? "video/mp4" : "image/jpeg");

        const { error: uploadError } = await supabase.storage.from("media").upload(fileName, fileData, {
          contentType,
        });
        if (uploadError) {
          throw uploadError;
        }
        const { data } = supabase.storage.from("media").getPublicUrl(fileName);
        fileUrl = data.publicUrl;
      }

      const { error: dbError } = await supabase.from("posts").insert({
        content,
        file_url: fileUrl,
        user_id: user.id,
      });
      if (dbError) {
        throw dbError;
      }

      Alert.alert("Posted!", "Your update is live.");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Upload failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput placeholder="What's on your mind?" value={content} onChangeText={setContent} multiline style={styles.input} />
      {mediaUri && (
        <View style={styles.previewContainer}>{mediaType === "video" ? <Video style={styles.preview} source={{ uri: mediaUri }} useNativeControls resizeMode={ResizeMode.CONTAIN} /> : <Image source={{ uri: mediaUri }} style={styles.preview} />}</View>
      )}
      <TouchableOpacity style={styles.pickButton} onPress={pickMedia}>
        <Text style={styles.pickText}>{mediaUri ? "Change media" : "Pick image or video"}</Text>
      </TouchableOpacity>
      <View style={styles.submit}>
        {uploading ? <ActivityIndicator size="large" color="#2563eb" /> : <Button title="Post" onPress={handlePost} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#fff" },
  input: { fontSize: 18, minHeight: 80, textAlignVertical: "top", marginBottom: 16 },
  previewContainer: { marginBottom: 16, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  preview: { width: "100%", height: 300 },
  pickButton: { backgroundColor: "#f2f4f7", padding: 16, borderRadius: 10, alignItems: "center", marginBottom: 24 },
  pickText: { fontWeight: "600", color: "#111827" },
  submit: { marginTop: "auto" },
});

