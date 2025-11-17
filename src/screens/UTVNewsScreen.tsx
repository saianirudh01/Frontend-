import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext'; // Import the context
import { useNavigation } from '@react-navigation/native';
import { getAllNews } from '../services/api';
import { NEWS_API_BASE_URL } from '../services/config';

const { width } = Dimensions.get('window');

// Helper function to get full media URL
const getMediaUrl = (mediaUrl: string | null) => {
  if (!mediaUrl) {
    console.log('⚠️ No media URL provided, using placeholder');
    return 'https://placehold.co/600x400/3f51b5/ffffff?text=News+Article';
  }
  
  // If it's already a full URL, return as-is
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    console.log('✅ Full URL already:', mediaUrl);
    return mediaUrl;
  }
  
  // Remove /api from NEWS_API_BASE_URL to get base server URL
  // NEWS_API_BASE_URL = "http://172.16.2.64:5173/api"
  // We want: "http://172.16.2.64:5173"
  const baseUrl = NEWS_API_BASE_URL.replace('/api', '');
  
  // Ensure mediaUrl starts with /
  const path = mediaUrl.startsWith('/') ? mediaUrl : '/' + mediaUrl;
  const fullUrl = `${baseUrl}${path}`;
  
  console.log('🔧 Constructed URL:', mediaUrl, '→', fullUrl);
  return fullUrl;
};


export default function UTVNewsScreen() {
  // Get the signOut function from the context
  const { signOut } = useContext(AuthContext);
  const navigation = useNavigation<any>();
  
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch news on component mount
  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      setLoading(true);
      const allNews = await getAllNews();
      
      console.log('📰 Raw news data from API:', allNews.length, 'items');
      if (allNews.length > 0) {
        console.log('📰 Sample news item:', JSON.stringify(allNews[0], null, 2));
      }
      
      // Transform server response to match card interface
      const transformedNews = allNews.map((item: any) => {
        const mediaUrl = getMediaUrl(item.mediaUrl || item.media_url);
        console.log(`📷 Media URL for "${item.news_title}":`, item.mediaUrl || item.media_url, '→', mediaUrl);
        
        return {
          _id: item.news_id,
          title: item.news_title,
          description: item.news_description || item.news_title,
          mediaUrl: mediaUrl, // Use helper to construct full URL
          category: item.category_name || 'General',
          status: item.status_code,
          reporterName: item.reporter_name || 'Anonymous',
          createdAt: item.creation_date,
          location: item.location,
          fullItem: item
        };
      });
      
      setNews(transformedNews);
    } catch (error) {
      console.error('Failed to load news:', error);
      Alert.alert('Error', 'Could not load news');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNews();
    setRefreshing(false);
  };

  const handleViewDetails = (newsItem: any) => {
    // Determine media type from URL or field
    const determineMediaType = (url: string | null) => {
      if (!url) return 'image';
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.match(/\.(mp4|mov|avi|mkv|webm)$/)) return 'video';
      if (lowerUrl.match(/\.(mp3|wav|m4a|aac|ogg)$/)) return 'audio';
      return 'image';
    };

    // Transform to ViewNewsScreen format
    const article = {
      id: newsItem._id,
      title: newsItem.title,
      description: newsItem.description,
      category: newsItem.category,
      status: newsItem.status,
      date: newsItem.createdAt ? newsItem.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
      mediaUrl: newsItem.mediaUrl,
      mediaType: newsItem.fullItem?.media_type || newsItem.fullItem?.mediaType || determineMediaType(newsItem.mediaUrl),
      location: newsItem.fullItem?.location || 'Unknown',
      reporterName: newsItem.reporterName,
      submittedAt: newsItem.createdAt || new Date().toISOString()
    };
    navigation.navigate('ViewNews', { article });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => handleViewDetails(item)}
      activeOpacity={0.7}
    >
      <View style={styles.card}>
        <Image source={{ uri: item.mediaUrl }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>{item.category}</Text>
            <Text style={styles.metaText}>•</Text>
            <Text style={styles.metaText}>{item.reporterName || 'Unknown'}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="heart-outline" size={24} color="#757575" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="bookmark-outline" size={24} color="#757575" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-social-outline" size={24} color="#757575" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="newspaper-outline" size={64} color="#E0E0E0" />
      <Text style={styles.emptyText}>No news available</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>UTV News</Text>
        {/* --- THIS IS THE NEW LOGOUT BUTTON --- */}
        <TouchableOpacity onPress={signOut}>
          <Ionicons name="menu" size={32} color="#212121" />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FDD835" />
          <Text style={styles.loadingText}>Loading news...</Text>
        </View>
      ) : (
        <FlatList
          data={news}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' }, // Light grey background
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#757575',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212121',
  },
  listContainer: {
    padding: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#999',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: width * 0.5, // 16:9 aspect ratio
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  cardContent: {
    padding: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  cardDescription: {
    fontSize: 14,
    color: '#757575',
    marginTop: 5,
  },
  cardMeta: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  cardActions: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 10,
  },
  actionButton: {
    padding: 5,
    marginRight: 10,
  },
});
