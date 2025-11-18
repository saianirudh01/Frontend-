import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AuthContext } from "../services/AuthContext";
import { fetchNewsByJournalist, getStatusColor, getStatusText, NewsItem } from "../services/api";

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = React.useContext(AuthContext);
  const [searchText, setSearchText] = useState("");
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    if (!user || !user.jornalistId) {
      Alert.alert('Error', 'Reporter ID not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const newsArray = await fetchNewsByJournalist(user.jornalistId);
      
      // API returns array directly
      if (Array.isArray(newsArray)) {
        // Sort by creation_date descending (newest first)
        const sortedNews = newsArray.sort((a, b) => 
          new Date(b.creation_date).getTime() - new Date(a.creation_date).getTime()
        );
        setNewsData(sortedNews);
        console.log('✅ Loaded news items:', sortedNews.length);
      } else {
        setNewsData([]);
      }
    } catch (error: any) {
      console.error('❌ Failed to load news:', error);
      Alert.alert('Error', 'Failed to load your news. Please try again.');
      setNewsData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNews();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredData = newsData.filter((n) =>
    n.news_title.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => console.log("Logout pressed"),
      },
    ]);
  };

  const renderItem = ({ item }: { item: NewsItem }) => {
    console.log('📰 Rendering news item:', {
      id: item.news_id,
      title: item.news_title,
      media_url: item.media_url,
      media_type: item.media_type,
    });

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => {
          console.log('🔗 Navigating to ViewNews with:', {
            id: item.news_id,
            title: item.news_title,
            description: item.news_description,
            mediaUrl: item.media_url,
          });
          
          // Navigate to the parent stack navigator
          const parentNav = navigation.getParent();
          if (parentNav) {
            parentNav.navigate('ViewNews', {
              article: {
                id: item.news_id,
                title: item.news_title,
                description: item.news_description,
                category: item.category_name,
                date: formatDate(item.creation_date),
                status: getStatusText(item.status_code),
                mediaUrl: item.media_url,
                mediaType: item.media_type,
                location: item.location,
                reporterName: item.reporter_name,
              }
            });
          } else {
            // Fallback to direct navigation
            navigation.navigate('ViewNews', {
              article: {
                id: item.news_id,
                title: item.news_title,
                description: item.news_description,
                category: item.category_name,
                date: formatDate(item.creation_date),
                status: getStatusText(item.status_code),
                mediaUrl: item.media_url,
                mediaType: item.media_type,
                location: item.location,
                reporterName: item.reporter_name,
              }
            });
          }
        }}
      >
        <View style={styles.row}>
          {item.media_url && (
            <Image 
              source={{ uri: item.media_url }} 
              style={styles.thumbnail}
              resizeMode="cover"
              onError={(error) => console.log('❌ Image load error for:', item.media_url, error.nativeEvent.error)}
              onLoad={() => console.log('✅ Image loaded:', item.media_url)}
            />
          )}
          <View style={{ flex: 1, marginLeft: item.media_url ? 12 : 0 }}>
            <Text style={styles.title} numberOfLines={2}>{item.news_title}</Text>
            <Text style={styles.meta}>
              {item.sub_category_name || item.category_name} · {formatDate(item.creation_date)}
            </Text>
          </View>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(item.status_code) },
            ]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{user?.name || "Reporter"}</Text>
          <Text style={styles.location}>{user?.location || "Hyderabad"}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Search news..."
        style={styles.searchBar}
        placeholderTextColor="#aaa"
        value={searchText}
        onChangeText={setSearchText}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FDD835" />
          <Text style={{ marginTop: 12, color: '#757575' }}>Loading your news...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.news_id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#FDD835']} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 12 },
  header: {
    backgroundColor: "#222",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  location: { color: "#FDD835", fontSize: 13 },
  searchBar: {
    marginVertical: 12,
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    padding: 10,
    color: "#000",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  title: { fontWeight: "bold", color: "#000", fontSize: 15 },
  meta: { fontSize: 12, color: "#000000", marginTop: 4 },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignSelf: "center",
    marginLeft: 8,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
