import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Button,
  TouchableOpacity,
} from 'react-native';
import { fetchMySubmissions, getNewsById } from '../services/api'; // Use our api
import { AuthContext } from '../services/AuthContext';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Submission {
  _id: string;
  title: string;
  status: 'Draft' | 'Submitted' | 'Review' | 'Published' | 'Revision Requested';
  submittedAt: string;
}

export default function SubmissionListScreen() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { signOut, user } = useContext(AuthContext);
  const isFocused = useIsFocused(); // Re-fetch when screen is focused
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      // Fetch server-side submissions for the logged-in journalist
      let serverList: Submission[] = [];
      if (user?.jornalistId) {
        try {
          const fetchedSubmissions = await fetchMySubmissions(user.jornalistId);
          // Filter to show only submitted/approved/published (hide drafts as those are stored locally)
          serverList = fetchedSubmissions.filter(item => 
            item.status !== 'Draft' && item.status !== 'DRAFT'
          );
          console.log('📊 Server submissions (filtered):', serverList);
        } catch (e) {
          console.warn('Failed to fetch server submissions, continuing with local drafts', e);
        }
      }

      // Load locally saved drafts from AsyncStorage and merge them
      let localDrafts: Submission[] = [];
      try {
        const existingDrafts = await AsyncStorage.getItem('drafts');
        if (existingDrafts) {
          const drafts = JSON.parse(existingDrafts);
          // Filter drafts that belong to this user (if drafts store jornalistId)
          const userDrafts = drafts.filter((d: any) => !d.jornalistId || d.jornalistId === user?.jornalistId);
          localDrafts = userDrafts.map((d: any, index: number) => ({
            _id: d.id ? `draft-${d.id}` : `draft-${user?.jornalistId || 'unknown'}-${d.savedAt || Date.now()}-${index}`,
            title: d.title || 'Untitled Draft',
            status: 'Draft' as const,
            submittedAt: d.savedAt || new Date().toISOString(),
          }));
          console.log('💾 Local drafts loaded:', localDrafts);
        }
      } catch (e) {
        console.warn('Error reading local drafts', e);
      }

      // Merge: local drafts first, then server submissions (no duplicates)
      const merged = [...localDrafts, ...serverList.filter(s => !localDrafts.find(ld => ld._id === s._id))];
      console.log('🔀 Merged submissions:', merged);
      setSubmissions(merged);
    } catch (error) {
      console.error('Failed to fetch submissions', error);
      Alert.alert('Error', 'Could not load your submissions.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch when the screen is focused or when refresh flag is passed
  useEffect(() => {
    if (isFocused && user) {
      fetchSubmissions();
      // Clear the refresh flag after fetching
      if (route.params?.refresh) {
        navigation.setParams({ refresh: false });
      }
    }
  }, [isFocused, user, route.params?.refresh]);

  const getStatusColor = (status: Submission['status']) => {
    switch (status) {
      case 'Published':
        return '#28a745'; // Green
      case 'Submitted':
      case 'Review':
        return '#007AFF'; // Blue
      case 'Revision Requested':
        return '#ffc107'; // Yellow
      case 'Draft':
        return '#6c757d'; // Gray
      default:
        return '#333';
    }
  };

  const handleViewNews = async (newsId: string) => {
    try {
      console.log('Viewing news:', newsId);
      setLoading(true);
      const newsDetails = await getNewsById(newsId);
      setLoading(false);
      navigation.navigate('ViewNews', { article: newsDetails });
    } catch (error) {
      setLoading(false);
      console.error('Failed to fetch news details:', error);
      Alert.alert('Error', `Could not load news details. ${error?.response?.data?.error || error?.message || 'Unknown error'}`);
    }
  };

  const renderItem = ({ item }: { item: Submission }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => handleViewNews(item._id)}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[styles.status, { backgroundColor: getStatusColor(item.status) }]}
        >
          {item.status}
        </Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.date}>
        {new Date(item.submittedAt).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Submissions ({user?.name})</Text>
        <Button title="Logout" onPress={signOut} color="#ff3b30" />
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>You have no submissions yet.</Text>
          }
          refreshing={loading}
          onRefresh={fetchSubmissions}
          style={{ paddingHorizontal: 15 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: 40, // Added padding for status bar
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  status: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 5,
  },
  date: {
    fontSize: 12,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#888',
  },
});