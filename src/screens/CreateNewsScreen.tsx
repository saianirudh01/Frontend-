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
  createNews,
  submitNewsForApproval,
  updateNews,
  NewsData,
  CreateNewsResponse,
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
  const [location, setLocation] = useState(draft?.location || '');
  const [locationLoading, setLocationLoading] = useState(true);

  // Media State
  const [localMediaUri, setLocalMediaUri] = useState(draft?.localMediaUri || null);
  const [mediaUrl, setMediaUrl] = useState(draft?.mediaUrl || null);
  const [mediaType, setMediaType] = useState(draft?.mediaType || null);
  const [existingDraftId, setExistingDraftId] = useState(draft?.id || null);
  const [createdNewsId, setCreatedNewsId] = useState<string | null>(null);
  const [newsSubmissionStep, setNewsSubmissionStep] = useState<'idle' | 'saved' | 'submitted'>('idle');

  // Audio State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Audio file path state
  const [audioFilePath, setAudioFilePath] = useState<string | null>(null);
  
  // Three-step audio workflow state
  const [audioWorkflowStep, setAudioWorkflowStep] = useState<'idle' | 'uploaded' | 'transcribed' | 'generated'>('idle');
  const [rawTranscript, setRawTranscript] = useState<string>('');

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
      
      setLocationLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Cannot get location.');
        setLocation('Location unavailable');
        setLocationLoading(false);
        return;
      }

      try {
        let locationData = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        let geocode = await Location.reverseGeocodeAsync(locationData.coords);
        if (geocode.length > 0) {
          const { city, country } = geocode[0];
          setLocation(`${city || 'Unknown'}, ${country || 'Unknown'}`);
        } else {
          setLocation('Location unavailable');
        }
      } catch (error) {
        console.error('Location error:', error);
        setLocation('Location unavailable');
      }
      setLocationLoading(false);
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
        mediaTypes: ['images', 'videos'],
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
      
      // Validate file extension - must be audio
      const fileName = asset.name || asset.uri.split('/').pop() || '';
      const fileExt = fileName.toLowerCase().split('.').pop();
      const validAudioExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'wma', 'webm'];
      
      if (!validAudioExtensions.includes(fileExt || '')) {
        Alert.alert('Invalid File', `Please select an audio file. Selected file: ${fileName}\n\nSupported formats: MP3, WAV, M4A, OGG, AAC`);
        return;
      }
      
      setAudioUri(asset.uri);
      setAudioFileName(asset.name);
      
      // Reset workflow state when new audio is selected
      setAudioFilePath(null);
      setAudioWorkflowStep('idle');
      setRawTranscript('');
      
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: asset.uri });
      soundRef.current = newSound;

      // Step 1: Upload audio and get file path
      await handleAudioUpload(asset.uri, asset.name);

    } catch (err) {
      console.warn(err);
      Alert.alert('Error', 'Failed to pick audio file.');
    }
  };
  
  // Step 1: Upload audio file
  const handleAudioUpload = async (uri: string, filename?: string) => {
    try {
      setLoadingText('Uploading Audio');
      
      const { filePath } = await uploadAudio(uri, filename);
      
      setAudioFilePath(filePath);
      setAudioWorkflowStep('uploaded');
      
      console.log('✅ Step 1 complete - File uploaded:', filePath);
      
    } catch (error) {
      console.error('Audio upload error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to upload audio.';
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setLoadingText(null);
    }
  };
  
  // Step 2: Generate transcript from uploaded audio
  const handleGenerateTranscript = async () => {
    if (!audioFilePath) {
      Alert.alert('Error', 'No audio file uploaded');
      return;
    }
    
    try {
      setLoadingText('Generating Transcript');
      
      const { transcript } = await transcribeAudioFile(audioFilePath);
      
      setRawTranscript(transcript);
      setDescription(transcript); // Put transcript in description box for editing
      setAudioWorkflowStep('transcribed');
      
      console.log('✅ Step 2 complete - Transcript generated');
      
    } catch (error) {
      console.error('Transcription error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to generate transcript.';
      Alert.alert('Transcription Error', errorMessage);
    } finally {
      setLoadingText(null);
    }
  };
  
  // Step 3: Create article from transcript
  const handleCreateArticleFromTranscript = async () => {
    const transcriptToUse = description.trim() || rawTranscript;
    
    if (!transcriptToUse) {
      Alert.alert('Error', 'No transcript available');
      return;
    }
    
    try {
      setLoadingText('Creating Article');
      
      const { title: generatedTitle, content: generatedContent } = await generateNewsFromTranscript(transcriptToUse);
      
      setTitle(generatedTitle);
      setDescription(generatedContent);
      setAudioWorkflowStep('generated');
      
      console.log('✅ Step 3 complete - Article created');
      
    } catch (error) {
      console.error('Article generation error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create article.';
      Alert.alert('Generation Error', errorMessage);
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
  
  // Helper to map category names to IDs
  const getCategoryId = (categoryName: string): number => {
    const categoryMap: Record<string, number> = {
      'Politics': 1,
      'Business': 2,
      'Technology': 3,
      'Sports': 4,
      'Entertainment': 5,
      'Health': 6,
      'Science': 7,
      'World': 8,
      'General News': 9,
    };
    return categoryMap[categoryName] || 9;
  };

  // Main Submit Function - Integrated with News Management API
  const handleSubmit = async (type: 'draft' | 'submit') => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Title Missing', 'Please add a news title.');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Description Missing', 'Please add a news description.');
      return;
    }
    
    if (!user || !user.jornalistId) {
      Alert.alert('Error', 'Could not find reporter ID. Please log out and log back in.');
      return;
    }

    try {
      // Step 1: Upload media if needed
      let finalMediaUrl = mediaUrl;
      if (localMediaUri && !mediaUrl) {
        setLoadingText('Uploading Media...');
        try {
          const response = await uploadMedia(localMediaUri, mediaType || 'image');
          if (response?.mediaUrl) {
            finalMediaUrl = response.mediaUrl;
            setMediaUrl(response.mediaUrl);
            console.log('✅ Media uploaded:', response.mediaUrl);
          }
        } catch (mediaError: any) {
          console.error('❌ Media upload failed:', mediaError);
          // Show error but allow continuing without media
          Alert.alert(
            'Media Upload Failed',
            `${mediaError.message}\n\nDo you want to continue submitting without media?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => { setLoadingText(null); return; } },
              { text: 'Continue', onPress: () => {} }
            ]
          );
          // Wait for user decision before continuing
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Step 2: Handle based on action type
      if (type === 'draft') {
        // Save as draft - use update if exists, create if new
        setLoadingText('Saving Draft...');
        
        if (createdNewsId) {
          // Update existing draft
          const updateData = {
            news_id: createdNewsId,
            news_title: title,
            news_description: description,
            category_id: getCategoryId(category),
            sub_category_name: category,
            location: location,
            media_url: finalMediaUrl || undefined,
            media_type: mediaType || undefined,
            status_code: 'DRAFT',
          };
          
          const updateResponse = await updateNews(updateData);
          
          if (updateResponse.success) {
            setLoadingText(null);
            Alert.alert(
              'Success',
              'Draft updated successfully!',
              [{ text: 'OK' }]
            );
          }
        } else {
          // Create new news - Note: API creates as PENDING with auto-assignment
          const newsData: NewsData = {
            journalist_id: user.jornalistId,
            news_title: title,
            news_description: description,
            category_id: getCategoryId(category),
            sub_category_name: category,
            location: location,
            media_url: finalMediaUrl || undefined,
            media_type: mediaType || undefined,
          };
          
          const createResponse: CreateNewsResponse = await createNews(newsData);
          
          if (createResponse.news_id) {
            setCreatedNewsId(createResponse.news_id);
            setNewsSubmissionStep('submitted'); // API creates as PENDING
            
            console.log('✅ News created with ID:', createResponse.news_id);
            console.log('✅ Status:', createResponse.status);
            console.log('✅ Approvers assigned:', createResponse.assignment);
            
            setLoadingText(null);
            Alert.alert(
              'Success',
              `News created and submitted for approval!\\n\\nNews ID: ${createResponse.news_id}\\nStatus: ${createResponse.status}\\n\\nApprover 1: ${createResponse.assignment.approver1.name}\\nApprover 2: ${createResponse.assignment.approver2.name}`,
              [{ text: 'OK' }]
            );
          }
        }
      } else if (type === 'submit') {
        // Submit for approval
        if (!createdNewsId) {
          // Create new news (API auto-creates as PENDING with assignment)
          setLoadingText('Creating and Submitting...');
          
          const newsData: NewsData = {
            journalist_id: user.jornalistId,
            news_title: title,
            news_description: description,
            category_id: getCategoryId(category),
            sub_category_name: category,
            location: location,
            media_url: finalMediaUrl || undefined,
            media_type: mediaType || undefined,
          };
          
          const createResponse: CreateNewsResponse = await createNews(newsData);
          
          if (createResponse.news_id) {
            setLoadingText(null);
            setSuccessModalInfo({
              visible: true,
              title: 'News Submitted!',
              message: `News ID: #${createResponse.news_id.slice(0, 8)}\\nAssigned to: ${createResponse.assignment.approver1.name} & ${createResponse.assignment.approver2.name}`
            });
            
            // Reset form
            setTitle('');
            setDescription('');
            setCategory('Politics');
            setLocalMediaUri(null);
            setMediaUrl(null);
            setCreatedNewsId(null);
            setNewsSubmissionStep('idle');
          }
        } else {
          // Submit existing draft
          setLoadingText('Submitting for Approval...');
          
          const submitResponse = await submitNewsForApproval(createdNewsId);
          
          if (submitResponse.success) {
            setNewsSubmissionStep('submitted');
            setLoadingText(null);
            
            setSuccessModalInfo({
              visible: true,
              title: 'News Submitted!',
              message: `News ID: #${createdNewsId.slice(0, 8)}`
            });
            
            // Reset form
            setTitle('');
            setDescription('');
            setCategory('Politics');
            setLocalMediaUri(null);
            setMediaUrl(null);
            setCreatedNewsId(null);
            setNewsSubmissionStep('idle');
          }
        }
      }
      
    } catch (error: any) {
      console.error('❌ Submission error:', error);
      setLoadingText(null);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to process your news.';
      Alert.alert('Error', errorMessage);
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
            {audioFilePath && audioWorkflowStep !== 'idle' && (
              <View style={styles.filePathContainer}>
                <Text style={styles.filePathLabel}>File Path:</Text>
                <TextInput
                  style={styles.filePathInput}
                  value={audioFilePath}
                  editable={false}
                  numberOfLines={1}
                />
              </View>
            )}
            
            {/* Step 2: Generate Transcript Button */}
            {audioWorkflowStep === 'uploaded' && (
              <TouchableOpacity
                style={styles.workflowButton}
                onPress={handleGenerateTranscript}
                disabled={isLoading}>
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                <Text style={styles.workflowButtonText}>Generate Transcript</Text>
              </TouchableOpacity>
            )}
            
            {/* Step 3: Create Article Button */}
            {audioWorkflowStep === 'transcribed' && (
              <TouchableOpacity
                style={styles.workflowButton}
                onPress={handleCreateArticleFromTranscript}
                disabled={isLoading}>
                <Ionicons name="newspaper-outline" size={20} color="#FFFFFF" />
                <Text style={styles.workflowButtonText}>Create Article from Transcript</Text>
              </TouchableOpacity>
            )}
            
            {/* Completion indicator */}
            {audioWorkflowStep === 'generated' && (
              <View style={styles.completionIndicator}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.completionText}>Article generated successfully!</Text>
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
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  filePathLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
    marginBottom: 5,
  },
  filePathInput: {
    fontSize: 11,
    color: '#424242',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    padding: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  filePathText: {
    fontSize: 11,
    color: '#424242',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  workflowButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  workflowButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  completionIndicator: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completionText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
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