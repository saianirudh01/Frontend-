import React from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Video } from 'expo-av';

export default function ViewNewsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>(); 
  
  // Get the entire article object passed from the list
  const article = route.params?.article;

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#212121" />
          </TouchableOpacity>
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Article not found</Text>
          <Text style={styles.description}>Please try again or go back.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Format date and time
  const metaInfo = `News ID: #${article.id?.substring(0, 4) || 'N/A'} • ${article.date || 'Unknown Date'} • ${article.status || 'Unknown'}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#212121" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {article.category || 'News'}
          </Text>
          <Text style={styles.headerMeta}>{metaInfo}</Text>
        </View>
      </View>

      <ScrollView>
        {article.mediaUrl && (
          article.mediaType === 'video' ? (
            <Video
              source={{ uri: article.mediaUrl }}
              style={styles.media}
              useNativeControls
              resizeMode="contain"
            />
          ) : article.mediaType === 'audio' ? (
            <View style={styles.audioContainer}>
              <Ionicons name="musical-notes" size={64} color="#FDD835" />
              <Text style={styles.audioLabel}>Audio News</Text>
              <Video
                source={{ uri: article.mediaUrl }}
                style={styles.audioPlayer}
                useNativeControls
                shouldPlay={false}
              />
            </View>
          ) : (
            <Image 
              source={{ uri: article.mediaUrl }} 
              style={styles.media}
              resizeMode="cover"
              onError={(error) => console.log('Image load error:', error.nativeEvent.error)}
            />
          )
        )}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{article.title || 'Untitled'}</Text>
          <Text style={styles.description}>{article.description || 'No description available'}</Text>
          {article.location && (
            <Text style={styles.meta}>📍 {article.location}</Text>
          )}
          {article.reporterName && (
            <Text style={styles.meta}>👤 By {article.reporterName}</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.submitButton, styles.saveButton]} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.saveButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 40 : 15,
    backgroundColor: '#FDD835', // Yellow header
  },
  backButton: {
    padding: 5,
    marginRight: 10,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  headerMeta: {
    fontSize: 12,
    color: '#212121',
  },
  editButton: {
    padding: 5,
    marginLeft: 10,
  },
  media: {
    width: '100%',
    height: 250,
    backgroundColor: '#000',
  },
  audioContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#212121',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioLabel: {
    color: '#FDD835',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 20,
  },
  audioPlayer: {
    width: '90%',
    height: 50,
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: '#424242',
    lineHeight: 26,
  },
  meta: {
    fontSize: 14,
    color: '#757575',
    marginTop: 10,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: 'bold',
  },
});