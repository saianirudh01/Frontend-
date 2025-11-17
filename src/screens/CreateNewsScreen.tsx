import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import {
  uploadMedia,
  uploadAndTranscribeAudio,
  uploadAudio,
  transcribeAudioFile,
  generateNewsFromTranscript,
  transcribeAudio,
  submitNews,
  polishText, // The new API function
  testTranscribeWithFilePath, // Test function for transcription
} from '../services/api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { AuthContext } from '../services/AuthContext'; // <-- NEW: Import AuthContext

// --- Full Screen Loading Animation ---
const LoadingOverlay = ({ text }) => (
  <Modal transparent={true} animationType="fade" visible={true}>
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color="#FDD835" />
      <Text style={styles.loadingText}>{text}...</Text>
    </View>
  </Modal>
);

// --- Suggestions Modal ---
const SuggestionsModal = ({ visible, suggestions, onSelect, onClose, onRefresh }) => {
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.suggestionsModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Suggestions</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.modalRefreshButton}>
              <Ionicons name="refresh" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => onSelect(item)}>
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// --- Success Modal ---
const SuccessModal = ({ visible, title, message, onClose }) => (
  <Modal
    transparent={true}
    animationType="fade"
    visible={visible}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.successModalContent}>
        <View style={styles.successIconCircle}>
          <Ionicons name="checkmark" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.successTitle}>{title}</Text>
        <Text style={styles.successMessage}>{message}</Text>
        <TouchableOpacity style={styles.successButton} onPress={onClose}>
          <Text style={styles.successButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// --- Component ---
type DraftNews = {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  time: string;
  location: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  localMediaUri?: string;
  status: 'draft';
};

type CreateNewsRouteParams = {
  draftToEdit?: DraftNews;
};

type CreateNewsRouteProp = RouteProp<{ params: CreateNewsRouteParams }, 'params'>;

const CATEGORIES = ['Politics', 'News', 'Sports', 'Local', 'Entertainment', 'General News'];

export default function CreateNewsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<CreateNewsRouteProp>();
  const draft = route.params?.draftToEdit;
  
  // --- NEW: Get user info from context ---
  const { user } = useContext(AuthContext);

  // Form State
  const [title, setTitle] = useState(draft?.title || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [category, setCategory] = useState(draft?.category || 'News');
  const [date, setDate] = useState(new Date());
  
  // Location State
  const [location, setLocation] = useState(draft?.location || 'Loading location...');

  // Media State
  const [localMediaUri, setLocalMediaUri] = useState(draft?.localMediaUri || null);
  const [mediaUrl, setMediaUrl] = useState(draft?.mediaUrl || null);
  const [mediaType, setMediaType] = useState(draft?.mediaType || null);
  const [existingDraftId, setExistingDraftId] = useState(draft?.id || null);

  // Audio State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Audio file path state
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);

  // Modal States
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [suggestionsModalVisible, setSuggestionsModalVisible] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [polishType, setPolishType] = useState<'title' | 'description'>('title');
  const [successModalInfo, setSuccessModalInfo] = useState<{ visible: boolean, title: string, message: string }>({ visible: false, title: '', message: '' });

  // Permissions and Location
  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
      await ImagePicker.requestCameraPermissionsAsync();
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Cannot get location.');
        setLocation('Permission denied');
        return;
      }

      let locationData = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let geocode = await Location.reverseGeocodeAsync(locationData.coords);
      if (geocode.length > 0) {
        const { city, country } = geocode[0];
        setLocation(`${city || 'Unknown'}, ${country || 'Unknown'}`);
      }
    })();
  }, []);

  // Unload sound on component unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  // Pick Media (Image/Video) - Display locally, upload later on submit
  const handlePickMedia = async () => {
    console.log('=== handlePickMedia called ===');
    
    let result: ImagePicker.ImagePickerResult;
    try {
      console.log('Launching ImagePicker...');
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });

      console.log('ImagePicker result:', result);

      if (result.canceled || !result.assets) {
        console.log('Picker canceled or no assets');
        return;
      }
      
      const asset = result.assets[0];
      const assetType = asset.type === 'video' ? 'video' : 'image';

      console.log('✅ Media selected:', { uri: asset.uri, type: assetType });

      // Just display the media locally - don't upload yet
      setLocalMediaUri(asset.uri);
      setMediaType(assetType);
      
    } catch (error) {
      console.error('❌ Error picking media:', error);
      Alert.alert('Error', 'Failed to launch media library.');
    } finally {
      setLoadingText(null);
    }
  };
  
  // Upload Audio File
  const handlePickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }
      
      const asset = result.assets[0];
      setAudioUri(asset.uri);
      setAudioFileName(asset.name);
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: asset.uri });
      soundRef.current = newSound;

      // Process audio: upload, transcribe, and generate title/content
      await handleAudioProcessing(asset.uri);

    } catch (err) {
      console.warn(err);
      Alert.alert('Error', 'Failed to pick audio file.');
    }
  };
  
  // Audio processing: nested flow (upload → transcribe → generate)
  const handleAudioProcessing = async (uri: string) => {
    try {
      setLoadingText('Uploading Audio');
      
      // This function now handles all three steps internally
      const { title: generatedTitle, content: generatedContent, filePath } = await uploadAndTranscribeAudio(uri);
      
      // Store the file path for display
      if (filePath) {
        setAudioFilePath(filePath);
      }
      
      console.log('🔍 BEFORE setState - generatedTitle:', generatedTitle);
      console.log('🔍 BEFORE setState - generatedContent:', generatedContent);
      
      // Update the form fields
      setTitle(generatedTitle);
      setDescription(generatedContent);
      
      console.log('✅ Audio processing complete - Title and content generated');
      
      // Debug: Check state after a brief delay
      setTimeout(() => {
        console.log('🔍 AFTER setState (delayed check) - title state should be:', generatedTitle);
        console.log('🔍 AFTER setState (delayed check) - description state should be:', generatedContent);
      }, 100);
      
    } catch (error) {
      console.error('Audio processing error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to process audio.';
      Alert.alert('Processing Error', errorMessage);
    } finally {
      setLoadingText(null);
    }
  };  // Audio Preview Function
  const playSound = async () => {
    if (soundRef.current) {
      console.log('Playing sound...');
      await soundRef.current.replayAsync();
    }
  };

  // Transcription
  const handleTranscription = async (uri: string, category: string) => {
    setLoadingText('Transcribing Audio');
    try {
      // Use deployed AI server for transcription
      const response = await transcribeAudio(uri, category);
      if (response.title && response.content) {
        setTitle(response.title);
        setDescription(response.content);
      } else {
        setDescription(response.content || 'Transcription failed.');
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || 'Failed to transcribe audio.';
      Alert.alert('Transcription Error', errorMessage);
    } finally {
      setLoadingText(null);
    }
  };

  // AI Polish Function
  const handlePolishText = async (type: 'title' | 'description') => {
    const textToPolish = type === 'title' ? title : description;

    if (!textToPolish.trim()) {
      Alert.alert('No Text', `Please write a ${type} first.`);
      return;
    }
    if (!category) {
      Alert.alert('No Category', 'Please select a category first.');
      return;
    }

    setLoadingText(`Polishing ${type}`);
    setPolishType(type);
    try {
      // Use deployed AI server for text polishing
      const response = await polishText(textToPolish, category, type);
      if (response.suggestions && response.suggestions.length > 0) {
        setSuggestions(response.suggestions);
        setSuggestionsModalVisible(true);
      } else {
        Alert.alert('AI Error', 'No suggestions were returned.');
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || 'Failed to get suggestions.';
      Alert.alert('AI Error', errorMessage);
    } finally {
      setLoadingText(null);
    }
  };

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion: string) => {
    if (polishType === 'title') {
      setTitle(suggestion);
    } else {
      setDescription(suggestion);
    }
    setSuggestionsModalVisible(false);
  };
  
  // Handle selecting a category
  const handleSelectCategory = (selectedCategory: string) => {
    setCategory(selectedCategory);
    setIsCategoryModalVisible(false);
  };
  
  // Main Submit Function
  const handleSubmit = async (type: 'draft' | 'submit') => {
    // Check if media exists (either as local URI or already uploaded URL)
    if (type === 'submit' && !mediaUrl && !localMediaUri) {
      Alert.alert('Media Missing', 'Please upload an image or video before submitting.');
      return;
    }
    
    if (!title) {
      Alert.alert('Title Missing', 'Please add a title.');
      return;
    }
    
    // --- NEW: Check for user and jornalistId ---
    if (type === 'submit' && (!user || !user.jornalistId)) {
        Alert.alert('Error', 'Could not find reporter ID. Please log out and log back in.');
        return;
    }

    setLoadingText(type === 'draft' ? 'Saving Draft' : 'Submitting News');
    
    // Upload media if it exists locally but hasn't been uploaded yet
    let finalMediaUrl = mediaUrl;
    if (localMediaUri && !mediaUrl) {
      try {
        setLoadingText('Uploading Media...');
        const response = await uploadMedia(localMediaUri, mediaType || 'image');
        if (response?.mediaUrl) {
          finalMediaUrl = response.mediaUrl;
          setMediaUrl(response.mediaUrl);
          console.log('✅ Media uploaded during submit:', response.mediaUrl);
        }
      } catch (error: any) {
        setLoadingText(null);
        console.error('❌ Failed to upload media:', error);
        Alert.alert('Upload Error', 'Failed to upload media. Please try again.');
        return;
      }
    }
    
    setLoadingText(type === 'draft' ? 'Saving Draft' : 'Submitting News');
    
    const liveDate = date.toISOString().split('T')[0];
    const liveTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newsData = {
      id: existingDraftId || `draft_${Date.now()}`,
      title,
      description,
      category,
      date: liveDate,
      time: liveTime,
      location: location,
      mediaUrl: finalMediaUrl,
      localMediaUri,
      mediaType,
      status: type,
      // Attach the reporter ID and timestamp so dashboard can associate drafts
      jornalistId: user?.jornalistId || null,
      savedAt: new Date().toISOString(),
    };

    if (type === 'draft') {
      try {
        const existingDrafts = await AsyncStorage.getItem('drafts');
        const drafts = existingDrafts ? JSON.parse(existingDrafts) : [];
        const otherDrafts = drafts.filter(d => d.id !== newsData.id);
        const updatedDrafts = [...otherDrafts, newsData];
        await AsyncStorage.setItem('drafts', JSON.stringify(updatedDrafts));

        setLoadingText(null);
        setSuccessModalInfo({
          visible: true,
          title: 'News Post saved!',
          message: `News ID: #${newsData.id.split('_').pop()}`
        });

      } catch (e) {
        setLoadingText(null);
        Alert.alert('Error', 'Failed to save draft.');
      }
    } else {
      // --- NEW: Submission data now includes jornalistId ---
      try {
        const submissionData = {
          jornalistId: user.jornalistId, // <-- The new required ID
          title,
          description,
          category,
          date: liveDate,
          time: liveTime,
          location: location,
          mediaUrl: finalMediaUrl,
          mediaType,
        };

        const response = await submitNews(submissionData);
        
        if (existingDraftId) {
          const existingDrafts = await AsyncStorage.getItem('drafts');
          const drafts = existingDrafts ? JSON.parse(existingDrafts) : [];
          const otherDrafts = drafts.filter(d => d.id !== existingDraftId);
          await AsyncStorage.setItem('drafts', JSON.stringify(otherDrafts));
        }
        
        setLoadingText(null);
        setSuccessModalInfo({
          visible: true,
          title: 'News Post Submitted!',
          message: `News ID: #${response.newsId.slice(0, 8)}`
        });

      } catch (error) {
        console.error('❌ Submission error:', error);
        console.error('❌ Error response:', error.response?.data);
        console.error('❌ Error status:', error.response?.status);
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to submit your news.';
        setLoadingText(null);
        Alert.alert('Submission Error', errorMessage);
      }
    }
  };

  const handleCloseSuccessModal = () => {
    setSuccessModalInfo({ visible: false, title: '', message: '' });
    // Reset form
    setTitle('');
    setDescription('');
    setCategory('News');
    setLocalMediaUri(null);
    setMediaUrl(null);
    setMediaType(null);
    setExistingDraftId(null);
    setAudioUri(null);
    setAudioFileName(null);
    if (soundRef.current) {
      soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    // Navigate to Home and force refresh
    navigation.navigate('Home', { refresh: true });
  };

  const isLoading = !!loadingText;

  return (
    <SafeAreaView style={styles.container}>
      
      {isLoading && <LoadingOverlay text={loadingText} />}

      <SuggestionsModal
        visible={suggestionsModalVisible}
        suggestions={suggestions}
        onSelect={handleSelectSuggestion}
        onClose={() => setSuggestionsModalVisible(false)}
        onRefresh={() => handlePolishText(polishType)}
      />

      <SuccessModal
        visible={successModalInfo.visible}
        title={successModalInfo.title}
        message={successModalInfo.message}
        onClose={handleCloseSuccessModal}
      />

      <Modal
        transparent={true}
        visible={isCategoryModalVisible}
        onRequestClose={() => setIsCategoryModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setIsCategoryModalVisible(false)}>
          <View style={styles.categoryModalContent}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={styles.modalItem}
                onPress={() => handleSelectCategory(cat)}>
                <Text style={styles.modalItemText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212121" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>
            {existingDraftId ? 'Edit News' : 'Create News'}
          </Text>
          <Text style={styles.headerDate}>
            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </Text>
        </View>
      </View>

      <ScrollView>
        <TouchableOpacity
          style={styles.uploadBox}
          onPress={handlePickMedia}>
          {localMediaUri ? (
            mediaType === 'video' ? (
              <Video
                source={{ uri: localMediaUri }}
                style={styles.mediaPreview}
                useNativeControls
                resizeMode={ResizeMode.COVER}
                isLooping
              />
            ) : (
              <Image
                source={{ uri: localMediaUri }}
                style={styles.mediaPreview}
              />
            )
          ) : (
            <>
              <Ionicons name="videocam-outline" size={48} color="#9E9E9E" />
              <Text style={styles.uploadBoxText}>Upload Media</Text>
            </>
          )}
          {loadingText === 'Uploading Media' && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#FDD835" />
            </View>
          )}
        </TouchableOpacity>

        {audioFileName ? (
          <>
            <View style={styles.audioPreviewContainer}>
              <Ionicons name="musical-notes" size={24} color="#007AFF" />
              <Text style={styles.audioFileName} numberOfLines={1}>{audioFileName}</Text>
              <TouchableOpacity onPress={playSound} style={styles.audioPlayButton}>
                <Ionicons name="play" size={24} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickAudioFile} style={styles.audioPlayButton}>
                <Ionicons name="reload" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            
            {/* Display audio file path */}
            {audioFilePath && (
              <View style={styles.filePathContainer}>
                <Text style={styles.filePathLabel}>Uploaded Audio File Path:</Text>
                <Text style={styles.filePathText} numberOfLines={2}>{audioFilePath}</Text>
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity
            style={styles.audioButton}
            onPress={handlePickAudioFile}
            disabled={isLoading}>
            <Ionicons name="mic-outline" size={20} color="#212121" />
            <Text style={styles.audioButtonText}>Upload News Audio (Optional)</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.form}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setIsCategoryModalVisible(true)}>
            <Text
              style={[
                styles.inputText,
                !category && styles.placeholderText,
              ]}>
              {category || 'Select a Category'}
            </Text>
            <Ionicons name="chevron-down-outline" size={20} color="#757575" />
          </TouchableOpacity>

          <Text style={styles.label}>Title</Text>
          {/* Debug: Show actual state value */}
          <Text style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>
            State value: {title || '(empty)'}
          </Text>
          <View style={styles.aiInputContainer}>
            <Ionicons name="sparkles-outline" size={22} color="#007AFF" style={styles.aiIcon} />
            <TextInput
              style={styles.aiInput}
              placeholder="Enter Title"
              placeholderTextColor="#9E9E9E"
              value={title}
              onChangeText={setTitle}
            />
            <TouchableOpacity
              style={styles.polishButton}
              onPress={() => handlePolishText('title')}
              disabled={isLoading}>
              <Text style={styles.polishButtonText}>Polish</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>Description</Text>
          {/* Debug: Show actual state value */}
          <Text style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>
            State value: {description.substring(0, 50) || '(empty)'}...
          </Text>
          <View style={[styles.aiInputContainer, styles.aiTextAreaContainer]}>
            <Ionicons name="sparkles-outline" size={22} color="#007AFF" style={styles.aiIcon} />
            <TextInput
              style={[styles.aiInput, styles.aiTextArea]}
              placeholder="Enter Description"
              placeholderTextColor="#9E9E9E"
              multiline
              numberOfLines={6}
              value={description}
              onChangeText={setDescription}
            />
             <TouchableOpacity
              style={styles.polishButton}
              onPress={() => handlePolishText('description')}
              disabled={isLoading}>
              <Text style={styles.polishButtonText}>Polish</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.charCount}>{description.length}/200</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.submitButton, styles.saveButton]}
            onPress={() => handleSubmit('draft')}
            disabled={isLoading}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, styles.submitButtonActive]}
            onPress={() => handleSubmit('submit')}
            disabled={isLoading}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    backgroundColor: '#FDD835', // Yellow header
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  headerDate: {
    fontSize: 12,
    color: '#212121',
  },
  uploadBox: {
    height: 200,
    backgroundColor: '#F5F5F5',
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadBoxText: {
    color: '#9E9E9E',
    marginTop: 10,
    fontSize: 16,
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  audioButtonText: {
    color: '#212121',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  audioPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 20,
    padding: 15,
  },
  audioFileName: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    marginLeft: 10,
    marginRight: 10,
  },
  audioPlayButton: {
    padding: 5,
  },
  form: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    color: '#616161',
    marginBottom: 8,
    fontWeight: '500',
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateInput: {
    flex: 1,
    marginRight: 10,
  },
  timeInput: {
    flex: 1,
    marginLeft: 10,
  },
  input: {
    height: 50,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#212121',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 16,
    color: '#212121',
  },
  placeholderText: {
    color: '#9E9E9E',
  },
  aiInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 15,
    paddingLeft: 15,
  },
  aiTextAreaContainer: {
    height: 120,
    alignItems: 'flex-start',
  },
  aiIcon: {
    marginRight: 10,
  },
  aiInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 0,
    fontSize: 16,
    color: '#212121',
  },
  aiTextArea: {
    textAlignVertical: 'top',
    paddingTop: 15,
    height: '100%',
  },
  polishButton: {
    padding: 10,
    marginRight: 5,
  },
  polishButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  charCount: {
    textAlign: 'right',
    color: '#9E9E9E',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
    flexDirection: 'row',
    justifyContent: 'center',
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
  submitButtonActive: {
    backgroundColor: '#FDD835',
  },
  submitButtonText: {
    color: '#212121',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryModalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
  },
  modalItem: {
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  modalItemText: {
    fontSize: 16,
    color: '#424242',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 12,
  },
  // --- SUGGESTIONS MODAL STYLES ---
  suggestionsModalContent: {
    width: '90%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 10,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  modalRefreshButton: {
    padding: 5,
  },
  suggestionItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionText: {
    fontSize: 16,
    color: '#424242',
  },
  modalCloseButton: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#757575',
  },
  // --- SUCCESS MODAL ---
  successModalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50', // Green
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 10,
  },
  successMessage: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 25,
  },
  successButton: {
    backgroundColor: '#FDD835',
    borderRadius: 8,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    fontSize: 16,
    color: '#212121',
    fontWeight: 'bold',
  },
  // --- FILE PATH DISPLAY ---
  filePathContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 15,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  filePathLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 5,
  },
  filePathText: {
    fontSize: 11,
    color: '#424242',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  testButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonSecondary: {
    backgroundColor: '#4CAF50',
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
});