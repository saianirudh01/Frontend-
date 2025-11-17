import React, { useContext, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StatusBar, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, AuthContext } from './src/services/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import BottomTabNavigator from './src/components/BottomTabNavigator';
import CreateNewsScreen from './src/screens/CreateNewsScreen';
import ViewNewsScreen from './src/screens/ViewNewsScreen';

const Stack = createNativeStackNavigator();

// This component handles the navigation logic
const AppNavigator = () => {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    // We're still checking for a token
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FDD835" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is logged in
          <>
            <Stack.Screen name="Main" component={BottomTabNavigator} />
            <Stack.Screen name="CreateNews" component={CreateNewsScreen} />
            <Stack.Screen name="ViewNews" component={ViewNewsScreen} />
          </>
        ) : (
          // No user, show login
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// This is the main export of your app
export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="light-content" />
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#212121',
  },
});