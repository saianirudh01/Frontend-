import React, { useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
  Share,
  Clipboard,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';

export default function ViewNewsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>(); 
  const [shareModalVisible, setShareModalVisible] = useState(false);
  
  // Get the entire article object passed from the list
  const article = route.params?.article;

  console.log('📄 ViewNewsScreen received params:', route.params);
  console.log('📄 Article data:', article);

  if (!article) {
    console.log('❌ No article data found in route params!');
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

  console.log('✅ Article loaded:', {
    id: article.id,
    title: article.title,
    hasMedia: !!article.mediaUrl,
    mediaType: article.mediaType,
  });

  // Generate shareable news link
  const newsLink = `https://utvnews.com/news/${article.id}`;

  // Handle native share
  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `${article.title}\n\n${article.description?.substring(0, 200)}...\n\nRead more: ${newsLink}`,
        url: newsLink, // iOS will use this
        title: article.title,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with activity type:', result.activityType);
        } else {
          console.log('Article shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share article');
      console.error('Share error:', error);
    }
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    Clipboard.setString(newsLink);
    Alert.alert('Link Copied', 'News link has been copied to clipboard!');
  };

  // Handle save (to be implemented)
  const handleSave = () => {
    Alert.alert('Save', 'Save functionality will be implemented soon!');
  };

  // Format date and time - show published date
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    return `${date.toLocaleDateString('en-US', dateOptions)} • ${date.toLocaleTimeString('en-US', timeOptions)}`;
  };

  const metaInfo = `${formatDateTime(article.date)} • ${article.status || 'Unknown'}`;

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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShareModalVisible(true)} style={styles.iconButton}>
            <Ionicons name="share-social-outline" size={24} color="#212121" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSave} style={styles.iconButton}>
            <Ionicons name="bookmark-outline" size={24} color="#212121" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Share Modal */}
      <Modal
        visible={shareModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sharing link</Text>
              <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close" size={24} color="#212121" />
              </TouchableOpacity>
            </View>
            
            {/* Link with copy button */}
            <View style={styles.linkContainer}>
              <View style={styles.linkTextContainer}>
                <Image 
                  source={{ uri: article.mediaUrl || 'https://via.placeholder.com/50' }} 
                  style={styles.linkThumbnail}
                />
                <View style={styles.linkInfo}>
                  <Text style={styles.linkTitle} numberOfLines={2}>{article.title}</Text>
                  <Text style={styles.linkUrl} numberOfLines={1}>{newsLink}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCopyLink} style={styles.copyButton}>
                <Ionicons name="copy-outline" size={20} color="#212121" />
              </TouchableOpacity>
            </View>

            {/* Share platforms text */}
            <Text style={styles.sharePlatformsText}>Or share via</Text>

            {/* Native share button */}
            <TouchableOpacity 
              onPress={() => {
                setShareModalVisible(false);
                handleShare();
              }} 
              style={styles.nativeShareButton}
            >
              <Ionicons name="share-outline" size={24} color="#212121" />
              <Text style={styles.nativeShareText}>Share to other apps...</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView>
        <View style={styles.contentContainer}>
          {/* Title */}
          <Text style={styles.title}>{article.title || 'Untitled'}</Text>
          
          {/* Author and Published Info */}
          <View style={styles.authorSection}>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>
                By {article.reporterName || 'Unknown Reporter'}
              </Text>
              <Text style={styles.publishedInfo}>
                Published {formatDateTime(article.date)}
              </Text>
            </View>
          </View>

          {/* Media */}
          {article.mediaUrl && (
            article.mediaType === 'video' ? (
              <Video
                source={{ uri: article.mediaUrl }}
                style={styles.media}
                useNativeControls
                resizeMode={ResizeMode.COVER}
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

          {/* Description */}
          <Text style={styles.description}>{article.description || 'No description available'}</Text>
          
          {/* Location */}
          {article.location && 
           article.location !== 'Loading location...' && 
           article.location !== 'Location unavailable' && 
           article.location !== 'Permission denied' && (
            <Text style={styles.meta}>📍 {article.location}</Text>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
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
    marginBottom: 16,
  },
  authorSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  publishedInfo: {
    fontSize: 13,
    color: '#000000',
  },
  description: {
    fontSize: 16,
    color: '#424242',
    lineHeight: 26,
    marginBottom: 15,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  linkTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  linkInfo: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 4,
  },
  linkUrl: {
    fontSize: 12,
    color: '#757575',
  },
  copyButton: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginLeft: 8,
  },
  sharePlatformsText: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 15,
    textAlign: 'center',
  },
  nativeShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 12,
  },
  nativeShareText: {
    fontSize: 16,
    color: '#212121',
    marginLeft: 10,
    fontWeight: '500',
  },
});