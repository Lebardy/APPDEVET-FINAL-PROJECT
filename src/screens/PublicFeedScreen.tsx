import { useState, useEffect, useCallback, useLayoutEffect } from "react";
import { StyleSheet, View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { supabase } from "../lib/supabase";
import { RootStackParamList } from "../navigation/types";

type Navigation = NativeStackNavigationProp<RootStackParamList, "PublicFeed">;

type PostRecord = {
  id: number;
  content: string | null;
  file_url: string | null;
  user_id: string;
  created_at: string;
  author_email: string;
};

export default function PublicFeedScreen() {
  const navigation = useNavigation<Navigation>();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<PostRecord | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("posts").select("*, author:profiles(email)").order("created_at", { ascending: false });
    if (error) {
      Alert.alert("Unable to load feed", error.message);
    } else {
      const formatted: PostRecord[] =
        data?.map((post: any) => ({
          id: post.id,
          content: post.content,
          file_url: post.file_url,
          user_id: post.user_id,
          created_at: post.created_at,
          author_email: post.author?.email ?? "unknown",
        })) ?? [];
      setPosts(formatted);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleSignOut]);

  const handleEdit = useCallback((post: PostRecord) => {
    setEditingPost(post);
    setEditContent(post.content || "");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingPost) return;
    setSaving(true);
    const { error } = await supabase.from("posts").update({ content: editContent }).eq("id", editingPost.id);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? { ...p, content: editContent } : p)));
      setEditingPost(null);
      setEditContent("");
    }
    setSaving(false);
  }, [editingPost, editContent]);

  const handleDelete = useCallback(
    (post: PostRecord) => {
      Alert.alert("Delete post?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (post.file_url) {
              const objectPath = post.file_url.split("/media/").pop();
              if (objectPath) {
                await supabase.storage.from("media").remove([objectPath]);
              }
            }
            const { error } = await supabase.from("posts").delete().eq("id", post.id);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
            }
          },
        },
      ]);
    },
    []
  );

  const renderPost = ({ item }: { item: PostRecord }) => {
    const isVideo = Boolean(item.file_url && (item.file_url.endsWith(".mp4") || item.file_url.endsWith(".mov")));
    const isMine = currentUserId === item.user_id;
    return (
      <View style={styles.card}>
        {item.file_url && (
          <View style={styles.mediaWrapper}>{isVideo ? <Video style={styles.media} source={{ uri: item.file_url }} useNativeControls resizeMode={ResizeMode.COVER} /> : <Image source={{ uri: item.file_url }} style={styles.media} />}</View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.content}>{item.content}</Text>
          <Text style={styles.meta}>
            {item.author_email} · {new Date(item.created_at).toLocaleDateString()}
          </Text>
          {isMine && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={fetchPosts}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? <ActivityIndicator color="#2563eb" /> : <Text style={styles.emptyText}>No posts yet. Tap + to share something.</Text>}
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("CreatePost")}>
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>

      <Modal visible={editingPost !== null} transparent animationType="slide" onRequestClose={() => setEditingPost(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Post</Text>
            <TextInput
              style={styles.modalInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              placeholder="What's on your mind?"
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingPost(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f4f7" },
  listContent: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 16, overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb" },
  mediaWrapper: { width: "100%", height: 260, backgroundColor: "#000" },
  media: { width: "100%", height: "100%" },
  cardBody: { padding: 16 },
  content: { fontSize: 16, marginBottom: 8 },
  meta: { fontSize: 12, color: "#6b7280" },
  actions: { flexDirection: "row", marginTop: 12, gap: 8 },
  editBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#dbeafe" },
  editText: { color: "#2563eb", fontWeight: "600" },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#fee2e2" },
  deleteText: { color: "#b91c1c", fontWeight: "600" },
  fab: { position: "absolute", bottom: 32, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 6 },
  fabText: { color: "#fff", fontSize: 32, marginTop: -4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 120 },
  emptyText: { color: "#6b7280" },
  signOut: { color: "#ef4444", fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "90%", backgroundColor: "#fff", borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, minHeight: 100, fontSize: 16, marginBottom: 20 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalCancelText: { color: "#6b7280", fontWeight: "600" },
  modalSave: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: "#2563eb", minWidth: 80, alignItems: "center" },
  modalSaveText: { color: "#fff", fontWeight: "600" },
});

