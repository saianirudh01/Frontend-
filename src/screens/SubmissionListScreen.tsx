import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../services/AuthContext'; // Import the context
import { fetchMySubmissions } from '../services/api'; // Import the new API function
import { useFocusEffect } from '@react-navigation/native'; // To refresh list on tab press

// --- NEW: Status icons based on your new Admin API docs ---
const statusIcons = {
  Draft: { icon: 'pencil', color: '#FDD835' }, // Yellow pencil
  Pending: { icon: 'hourglass-outline', color: '#FFA000' }, // Orange hourglass
  Approved: { icon: 'checkmark-circle-outline', color: '#4CAF50' }, // Green check
  Published: { icon: 'checkmark-done-circle', color: '#9C27B0' }, // Purple check
  Rejected: { icon: 'close-circle-outline', color: '#F44336' }, // Red X
};

// --- Helper component for when the list is empty ---
const EmptyListComponent = ({ isLoading }) => (
  <View style={styles.emptyContainer}>
    {isLoading ? (
      <ActivityIndicator size="large" color="#757575" />
    ) : (
      <>
        <Ionicons name="document-text-outline" size={64} color="#E0E0E0" />
        <Text style={styles.emptyText}>No submissions found.</Text>
        <Text style={styles.emptySubText}>Press the "+" button to create one.</Text>
      </>
    )}
  </View>
);

export default function SubmissionListScreen({ navigation }) {
  // Get user info and signOut function from the context
  const { user, signOut } = useContext(AuthContext);
  
  // State for submissions, loading, and search
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // --- NEW: Fetch data when the screen is focused ---
  useFocusEffect(
    React.useCallback(() => {
      const loadSubmissions = async () => {
        // Ensure we have the user and their jornalistId
        if (!user || !user.jornalistId) {
          console.log("No user or jornalistId, skipping fetch.");
          setIsLoading(false);
          return;
        }
        
        setIsLoading(true);
        try {
          // Call the new API function with the ID
          const data = await fetchMySubmissions(user.jornalistId);
          setSubmissions(data);
        } catch (error) {
          console.error("Failed to fetch submissions:", error);
          Alert.alert("Error", "Could not fetch your submissions.");
        } finally {
          setIsLoading(false);
        }
      };

      loadSubmissions();
    }, [user]) // Re-run this effect if the user object changes
  );

  // --- NEW: Filtered data based on search ---
  const filteredData = submissions.filter((item) =>
    item.title?.toLowerCase().includes(searchText.toLowerCase())
  );

  // --- NEW: Render item with real data ---
  const renderItem = ({ item }) => {
    // Default to 'Draft' if status is missing
    const status = statusIcons[item.status] || statusIcons.Draft; 
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => {
          console.log('🔗 Navigating to ViewNews with item:', item);
          navigation.navigate('ViewNews', { 
            article: {
              id: item._id,
              title: item.title,
              description: item.description,
              category: item.category,
              date: item.submittedAt || item.date || new Date().toISOString(),
              status: item.status,
              mediaUrl: item.mediaUrl,
              mediaType: item.mediaType,
              location: item.location || null,
              reporterName: item.reporterName || 'Unknown Reporter',
            }
          });
        }}
      >
        <Image
          source={{ uri: item.mediaUrl }}
          defaultSource={{ uri: 'https://placehold.co/100x100/eeeeee/999999?text=News' }} // Fallback
          style={styles.cardImage}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {/* Use the _id from the server, formatted like the mockup */}
          <Text style={styles.cardMeta}>
            News ID: #{item._id?.slice(0, 8) || 'N/A'}
          </Text>
          <Text style={styles.cardMeta}>
            {item.category} • {new Date(item.submittedAt || item.date).toLocaleDateString()} • {item.status}
          </Text>
        </View>
        <Ionicons name={status.icon} size={24} color={status.color} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* --- NEW: Header updated to match your mockup --- */}
      <View style={styles.header}>
        <View>
          {/* Use the user's name and location from context */}
          <Text style={styles.headerTitle}>{user?.name || 'Reporter'}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={16} color="#FDD835" />
            <Text style={styles.headerLocation}>{user?.location || 'Location'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={signOut}>
          <Ionicons name="menu" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Total Uploads</Text>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#757575" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#757575"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContainer}
        // Show a message if the list is empty
        ListEmptyComponent={<EmptyListComponent isLoading={isLoading} />}
      />
    </SafeAreaView>
  );
}

// --- NEW: Styles updated to match your mockup ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? 25 : 0, // Handle Android status bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#212121', // Dark header
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  headerLocation: {
    fontSize: 14,
    color: '#FDD835', // Yellow from mockup
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
    marginHorizontal: 20,
    marginTop: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#212121',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  cardContent: {
    flex: 1,
    marginLeft: 15,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212121',
  },
  cardMeta: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#757575',
    marginTop: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: '#BDBDBD',
    marginTop: 4,
  },
});