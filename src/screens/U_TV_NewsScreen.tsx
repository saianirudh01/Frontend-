import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';

// This is just a placeholder screen for the "UTV News" tab.
// We can build this out later.

export default function U_TV_NewsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>UTV News</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.contentText}>
          The UTV News feed will be displayed here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7F9',
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentText: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
  },
});