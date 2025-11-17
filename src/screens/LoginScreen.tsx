import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
} from 'react-native';
import { AuthContext } from '../services/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// --- NEW: A blurred background image ---
const BACKGROUND_IMAGE = 'https://placehold.co/600x800/212121/FFFFFF?text=UTV&font=raleway';
// --- NEW: A working UTV logo ---
const LOGO_IMAGE = 'https://placehold.co/200x200/FDD835/212121?text=U&font=raleway';

export default function LoginScreen() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!userId || !password) {
      Alert.alert('Error', 'Please enter user ID and password');
      return;
    }

    setLoading(true);
    try {
      await signIn(userId, password);
    } catch (error) {
      console.error('Sign in error:', error);
      let errorMessage = 'Invalid user ID or password.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground source={{ uri: BACKGROUND_IMAGE }} style={styles.container} blurRadius={10}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: LOGO_IMAGE }}
              style={styles.logo}
            />
          </View>

          <View style={styles.formContainer}>
            {/* --- NEW: Changed to match "User ID" and added icon --- */}
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="User ID" 
                placeholderTextColor="#9E9E9E"
                value={userId}
                onChangeText={setUserId}
                autoCapitalize="none"
              />
            </View>
            {/* --- NEW: Added icon --- */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9E9E9E"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
            
            <TouchableOpacity style={styles.forgotPasswordButton}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="large" color="#FDD835" />
            ) : (
              <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            )}
            {/* --- NEW: Added Signup text --- */}
            <TouchableOpacity style={styles.signupButton}>
              <Text style={styles.signupText}>Signup</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

// --- NEW: Styles updated to match your video ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#212121', 
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  formContainer: {
    backgroundColor: 'rgba(33, 33, 33, 0.8)', // Semi-transparent dark background
    marginHorizontal: 30,
    padding: 20,
    borderRadius: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // White background
    borderRadius: 8,
    marginBottom: 15,
  },
  inputIcon: {
    paddingLeft: 15,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 10,
    fontSize: 16,
    color: '#212121', // Dark text
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#FFFFFF', // White text
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#FDD835', // Yellow button
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#212121', 
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});