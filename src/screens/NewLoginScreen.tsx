import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
// This import path is correct and will work once we update App.tsx in the next step
import { AuthContext } from '../../App'; 
import { login } from '../services/api'; 

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      // --- THIS IS WHERE YOU CALL YOUR REAL LOGIN API ---
      // const { user, token } = await login(email, password);
      // signIn(user, token); // Pass real user and token

      // --- SIMULATED LOGIN (FOR NOW) ---
      // Comment out the simulation when your API is ready
      Alert.alert('Login Success', 'Welcome, Reporter!');
      const simulatedUser = { id: 'R001', name: 'Demo Reporter', email: email };
      const simulatedToken = 'fake-jwt-token-for-demo';
      signIn(simulatedUser, simulatedToken);
      // --- End of Simulation ---

    } catch (error) {
      console.error(error);
      Alert.alert('Login Failed', 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <Text style={styles.title}>UTV Reporter Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {loading ? (
          <ActivityIndicator size="large" />
        ) : (
          <Button title="Login" onPress={handleLogin} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  innerContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    margin: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
});