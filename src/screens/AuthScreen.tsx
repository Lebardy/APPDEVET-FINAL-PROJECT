import { useState } from "react";
import { StyleSheet, View, TextInput, Button, Text, Alert } from "react-native";
import { supabase } from "../lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter both email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert("Sign in failed", error.message);
    }
    setLoading(false);
  };

  const signUp = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter both email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert("Sign up failed", error.message);
    } else {
      Alert.alert("Check your inbox", "Confirm your email to finish sign up.");
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minimal Social</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" style={styles.input} />
      <View style={styles.buttonRow}>
        <Button title="Sign in" onPress={signIn} disabled={loading} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Create account" onPress={signUp} disabled={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#f4f6fb",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d8dce2",
    marginBottom: 14,
  },
  buttonRow: {
    marginTop: 8,
  },
});

