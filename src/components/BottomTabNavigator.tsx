import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import SubmissionListScreen from '../screens/SubmissionListScreen';
import UTVNewsScreen from '../screens/UTVNewsScreen';

const Tab = createBottomTabNavigator();

// Custom "Create" button
const CustomCreateButton = ({ onPress }) => (
  <TouchableOpacity
    style={styles.createButton}
    onPress={onPress}
  >
    <Ionicons name="add" size={32} color="#212121" />
  </TouchableOpacity>
);

// Custom Tab Bar Icon
const TabBarIcon = ({ route, focused, color, size }) => {
  let iconName;
  let label;

  if (route.name === 'Home') {
    iconName = focused ? 'home' : 'home-outline';
    label = 'Home';
  } else if (route.name === 'UTVNews') {
    iconName = focused ? 'tv' : 'tv-outline';
    label = 'UTV News';
  }

  return (
    <View style={styles.tabIconContainer}>
      <Ionicons name={iconName} size={size} color={color} />
      <Text style={[styles.tabLabel, { color: color }]}>{label}</Text>
    </View>
  );
};

export default function BottomTabNavigator() {
  const navigation = useNavigation<any>();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, // We use custom labels
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#212121', // Active icon color
        tabBarInactiveTintColor: '#757575', // Inactive icon color
        tabBarIcon: (props) => <TabBarIcon route={route} {...props} />,
      })}
    >
      <Tab.Screen
        name="Home"
        component={SubmissionListScreen}
      />
      <Tab.Screen
        name="Create"
        component={View} // Placeholder
        options={{
          tabBarButton: () => (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <CustomCreateButton
                onPress={() => navigation.navigate('CreateNews')}
              />
              <Text style={styles.createLabel}>Create</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="UTVNews"
        component={UTVNewsScreen}
        options={{
          title: 'UTV News'
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    height: Platform.OS === 'ios' ? 90 : 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    top: Platform.OS === 'ios' ? 10 : 0,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  createButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FDD835', // Yellow
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -25, // Lifts the button up
    shadowColor: '#FDD835',
    shadowRadius: 10,
    shadowOpacity: 0.5,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#FFFFFF' // White border
  },
  createLabel: {
    fontSize: 10,
    color: '#757575',
    marginTop: 30, // Position label below the button
  },
});