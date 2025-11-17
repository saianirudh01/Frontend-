import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin, setAuthToken } from './api';

// Define the shape of the user object based on your new API
interface User {
  id: string;
  name: string;
  email: string;
  location: string;
  jornalistId: string; // <-- This is the new, important field
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email, password) => Promise<void>;
  signOut: () => void;
}

// Create the context
export const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isLoading: true,
  signIn: async () => {},
  signOut: () => {},
});

// Create the provider component
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for stored token on app load
  useEffect(() => {
    const bootstrapAsync = async () => {
      let userToken;
      let userData;
      try {
        userToken = await AsyncStorage.getItem('userToken');
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          userData = JSON.parse(userDataString);
        }
        
        if (userToken && userData) {
          setToken(userToken);
          setUser(userData);
          setAuthToken(userToken); // Set axios auth header
        }
      } catch (e) {
        // Restoring token failed
        console.error('Failed to restore token', e);
      }
      setIsLoading(false);
    };

    bootstrapAsync();
  }, []);

  const authContextValue = {
    signIn: async (userId, password) => {
      setIsLoading(true);
      try {
        // ========== DUMMY LOGIN - REPLACE WITH API LATER ==========
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Accept any non-empty credentials
        if (!userId || !password) {
          throw new Error('Please enter user ID and password');
        }
        
        // Create dummy user data
        const dummyToken = 'dummy-jwt-token-' + Date.now();
        const userData = {
          id: userId,
          name: `User ${userId}`,
          email: `${userId}@utv.com`,
          role: 'reporter',
          location: 'Hyderabad',
          jornalistId: userId,
          empId: userId
        };
        
        // Save data to state
        setToken(dummyToken);
        setUser(userData);

        // Save data to persistent storage
        await AsyncStorage.setItem('userToken', dummyToken);
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        
        // Set axios auth header
        setAuthToken(dummyToken);
        
        // ========== TO RESTORE API LOGIN, UNCOMMENT BELOW: ==========
        // const response = await apiLogin(userId, password);
        // const { token, user: userData } = response;
        // if (!userData.jornalistId) {
        //    throw new Error("Login failed: 'jornalistId' was not provided by the server.");
        // }
        // setToken(token);
        // setUser(userData);
        // await AsyncStorage.setItem('userToken', token);
        // await AsyncStorage.setItem('userData', JSON.stringify(userData));
        // setAuthToken(token);
        // ========== END API LOGIN ==========
        
      } catch (error) {
        console.error('Sign in error:', error);
        throw error; // Re-throw error so LoginScreen can catch it
      } finally {
        setIsLoading(false);
      }
    },
    signOut: async () => {
      setIsLoading(true);
      try {
        // Clear state
        setToken(null);
        setUser(null);

        // Clear storage
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
        
        // Clear auth header
        setAuthToken(null);
      } catch (e) {
        console.error('Sign out error:', e);
      } finally {
        setIsLoading(false);
      }
    },
    token,
    user,
    isLoading,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};