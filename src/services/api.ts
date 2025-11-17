import axios from 'axios';
import { BASE_URL, AI_BASE_URL, NEWS_API_BASE_URL } from './config';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create an Axios instance to talk to your backend
const api = axios.create({
  baseURL: BASE_URL, // This is the main admin auth API (configured in `config.ts`)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create separate axios instance for news operations
const newsApi = axios.create({
  baseURL: NEWS_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance for local AI operations (transcribe, polish, media upload)
const aiApi = axios.create({
  baseURL: AI_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Function to set auth token
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    newsApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
    delete newsApi.defaults.headers.common['Authorization'];
  }
};

// Add response interceptor for token refresh/errors
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Token expired or invalid - clear stored data
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setAuthToken(null);
      // The AuthContext will handle navigation to login
    }
    return Promise.reject(error);
  }
);

newsApi.interceptors.response.use(
  response => response,
  async error => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setAuthToken(null);
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
// Real login using admin server auth API
export const login = async (userId, password) => {
  if (!userId || !password) {
    throw new Error('User ID and password are required');
  }
  
  try {
    console.log('Attempting login with userId:', userId);
    console.log('API URL:', `${BASE_URL}/auth/login`);
    
    const response = await api.post('/auth/login', {
      userId: userId,
      password: password
    });
    
    console.log('Login response:', response.data);
    
    // Admin API returns: { success, message, token, user: { userId, fullName, email, role, empId } }
    if (response.data.success) {
      return {
        token: response.data.token,
        user: {
          id: response.data.user.userId,
          name: response.data.user.fullName,
          email: response.data.user.email,
          role: response.data.user.role,
          location: "Hyderabad",
          jornalistId: response.data.user.userId, // Use userId as jornalistId
          empId: response.data.user.empId
        }
      };
    } else {
      throw new Error(response.data.error || response.data.message || 'Login failed');
    }
  } catch (error) {
    console.error('Login error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url
    });
    
    if (error.response?.status === 401) {
      throw new Error('Invalid user ID or password');
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    
    throw error;
  }
};

// --- Submissions ---
// Calls GET /news/by-journalist/:journalistId (admin news server)
export const fetchMySubmissions = async (jornalistId: string) => {
  try {
    const response = await newsApi.get(`/news/by-journalist/${jornalistId}`);
    console.log('📡 Submissions API response:', response.data);
    
    const newsList = response.data;
    
    // Handle if response is not an array
    if (!Array.isArray(newsList)) {
      console.warn('⚠️ API did not return an array:', newsList);
      return [];
    }
    
    // Transform admin API response to match app's Submission interface
    return newsList.map((item: any) => ({
      _id: item.news_id,
      title: item.news_title,
      description: item.news_description,
      category: item.category_name,
      status: item.status_code === 'DRAFT' ? 'Draft' : 
              item.status_code === 'PENDING' ? 'Submitted' :
              item.status_code === 'APPROVED' ? 'Review' :
              item.status_code === 'PUBLISHED' ? 'Published' :
              item.status_code === 'REJECTED' ? 'Revision Requested' : item.status_code,
      submittedAt: item.creation_date || new Date().toISOString(),
      mediaUrl: item.media_url || item.mediaUrl || null, // Support both field names
      mediaType: item.media_type || item.mediaType || null,
      location: item.location,
      reporterName: item.reporter_name
    }));
  } catch (error) {
    console.error('❌ Error fetching submissions:', error);
    console.error('❌ Error response:', error.response?.data);
    throw error;
  }
};

// Get news details by news ID
export const getNewsById = async (newsId: string) => {
  try {
    console.log(`Fetching news details for ID: ${newsId}`);
    const response = await newsApi.get(`/news/${newsId}`);
    const item = response.data;
    
    console.log('News response:', item);
    
    // Transform admin API response to match app's article interface
    return {
      id: item.news_id,
      title: item.news_title,
      description: item.news_description,
      category: item.category_name,
      status: item.status_code === 'DRAFT' ? 'Draft' : 
              item.status_code === 'PENDING' ? 'Submitted' :
              item.status_code === 'APPROVED' ? 'Review' :
              item.status_code === 'PUBLISHED' ? 'Published' :
              item.status_code === 'REJECTED' ? 'Revision Requested' : item.status_code,
      date: item.creation_date ? item.creation_date.split('T')[0] : new Date().toISOString().split('T')[0],
      mediaUrl: item.media_url || item.mediaUrl || 'https://placehold.co/300x200',
      mediaType: (item.media_url || item.mediaUrl)?.endsWith('.mp4') ? 'video' : 
                (item.media_url || item.mediaUrl)?.match(/\.(mp3|wav|m4a)$/i) ? 'audio' : 'image',
      location: item.location,
      reporterName: item.reporter_name,
      submittedAt: item.creation_date || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching news by ID:', error);
    throw error;
  }
};

// --- Get All News ---
// Fetches all published news from admin news server
export const getAllNews = async () => {
  try {
    console.log('🔄 Fetching news from:', `${NEWS_API_BASE_URL}/news/`);
    const response = await newsApi.get('/news/');
    // Admin API returns array of news items
    const newsList = response.data || [];
    
    console.log('✅ Received', newsList.length, 'news items');
    
    // Fetch media information for all news items
    try {
      const mediaResponse = await newsApi.get('/media/');
      const mediaList = mediaResponse.data || [];
      console.log('📁 Received', mediaList.length, 'media files');
      
      // Create a map of news_id to media_url
      const mediaMap = new Map();
      mediaList.forEach((media: any) => {
        if (media.news_id && media.file_path) {
          mediaMap.set(media.news_id, {
            url: media.file_path,
            type: media.media_type || 'image'
          });
        }
      });
      
      // Transform and add media URLs
      return newsList.map((item: any) => {
        const media = mediaMap.get(item.news_id);
        const mediaUrl = media ? media.url : null;
        const mediaType = media ? media.type : null;
        
        if (newsList.length > 0 && item === newsList[0]) {
          console.log('📋 First item with media:', {
            news_id: item.news_id,
            news_title: item.news_title,
            mediaUrl: mediaUrl,
            mediaType: mediaType
          });
        }
        
        return {
          ...item,
          mediaUrl: mediaUrl,
          mediaType: mediaType
        };
      });
    } catch (mediaError) {
      console.warn('⚠️ Could not fetch media list:', mediaError);
      // If media endpoint fails, return news without media
      return newsList.map((item: any) => ({
        ...item,
        mediaUrl: null,
        mediaType: null
      }));
    }
  } catch (error) {
    console.error('Error in getAllNews:', error);
    throw error;
  }
};

// Helper: map category name to ID (based on server's category list)
function getCategoryId(categoryName: string): number {
  const categoryMap: { [key: string]: number } = {
    'Politics': 1,
    'Sports': 2,
    'Entertainment': 3,
    'Local': 4,
    'News': 1,
    'General News': 1
  };
  return categoryMap[categoryName] || 1;
}

// Submit news directly to admin news server
export const submitNews = async (newsData) => {
  // Transform app data to admin API format
  const adminPayload = {
    journalist_id: newsData.jornalistId,
    news_title: newsData.title,
    news_description: newsData.description,
    category_id: getCategoryId(newsData.category),
    sub_category_name: newsData.category,
    location: newsData.location,
    latitude: null,
    longitude: null,
    media_url: newsData.mediaUrl || null,  // Now accessible from 172.16.2.64:8082
    media_type: newsData.mediaType || null,
  };
  
  console.log('📤 Submitting news to admin API:', JSON.stringify(adminPayload, null, 2));
  console.log('🔗 Endpoint:', `${NEWS_API_BASE_URL}/news/`);
  
  try {
    const response = await newsApi.post('/news/', adminPayload);
    console.log('✅ News submitted to admin API:', response.data);
    
    return {
      newsId: response.data.news_id,
      status: response.data.status,
      message: response.data.message || 'News submitted successfully',
      assignment: response.data.assignment // Approver assignment info
    };
  } catch (error) {
    console.error('❌ Submit news error:', error);
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Error status:', error.response?.status);
    throw error;
  }
};

// --- Media Upload (for Image/Video) ---
// Calls POST /media/upload on admin news API (NEWS_API_BASE_URL)
export const uploadMedia = async (fileUri: string, mediaType: 'image'|'video') => {
  try {
    console.log('🔄 Uploading media to:', `${NEWS_API_BASE_URL}/media/upload`);
    console.log('📎 File URI:', fileUri);
    console.log('📎 Media type:', mediaType);
    
    const formData = new FormData();
    
    // For web, fetch the blob from the URI
    if (Platform.OS === 'web') {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const filename = fileUri.split('/').pop() || `media_${Date.now()}.${mediaType === 'image' ? 'jpg' : 'mp4'}`;
      
      console.log('📦 Blob size:', blob.size, 'bytes');
      console.log('📦 Blob type:', blob.type);
      console.log('📦 Filename:', filename);
      
      // Create File object from blob (FastAPI expects this format)
      const file = new File([blob], filename, { type: blob.type });
      formData.append('file', file);
      
      // Use fetch API instead of axios for web uploads (better FormData support)
      console.log('🔄 Uploading to AI server:', `${AI_BASE_URL}/upload`);
      const uploadResponse = await fetch(`${AI_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type - browser will set it with boundary
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', uploadResponse.status, errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      const data = await uploadResponse.json();
      console.log('📡 Server response:', data);
      
      // Extract mediaUrl and filePath from response
      const mediaUrl = data?.data?.file_path || data?.mediaUrl || data?.file_path || data?.url || data?.filePath;
      const filePath = data?.data?.file_path || data?.file_path;
      
      if (!mediaUrl) {
        console.error('❌ Invalid upload response (missing mediaUrl):', data);
        throw new Error('Server did not return a valid media URL. Got: ' + JSON.stringify(data));
      }
      
      console.log('✅ Media uploaded:', mediaUrl);
      return { mediaUrl, filePath };
      
    } else {
      // For native platforms - use axios
      const fileType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
      const filename = fileUri.split('/').pop() || 'media';
      
      formData.append('file', {
        uri: fileUri,
        name: filename,
        type: fileType,
      } as any);
      
      // Use Python AI server for media upload
      console.log('🔄 Uploading to AI server:', `${AI_BASE_URL}/upload`);
      const uploadResponse = await aiApi.post('/upload', formData, {
        headers: {
          // Don't set Content-Type manually - let axios set it with the boundary
        },
      });
      
      console.log('📡 Server response:', uploadResponse.data);
      
      // Extract mediaUrl and filePath from response (handle multiple response formats)
      const mediaUrl = uploadResponse.data?.data?.file_path || 
                     uploadResponse.data?.mediaUrl || 
                     uploadResponse.data?.file_path || 
                     uploadResponse.data?.url ||
                     uploadResponse.data?.filePath;
      const filePath = uploadResponse.data?.data?.file_path || uploadResponse.data?.file_path;
      
      if (!mediaUrl) {
        console.error('❌ Invalid upload response (missing mediaUrl):', uploadResponse.data);
        throw new Error('Server did not return a valid media URL. Got: ' + JSON.stringify(uploadResponse.data));
      }
      
      console.log('✅ Media uploaded:', mediaUrl);
      return { mediaUrl, filePath };
    }
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorMsg = error.response?.statusText || error.message;
    
    console.error('❌ Upload failed:');
    console.error('  Status:', status);
    console.error('  Message:', errorMsg);
    console.error('  Response data:', JSON.stringify(errorData, null, 2));
    console.error('  Full error:', error);
    
    throw error;
  }
};

// --- Audio Upload and Process (Nested Flow) ---
// Step 1: Upload → Step 2: Transcribe → Step 3: Generate (all called sequentially)
export const uploadAndTranscribeAudio = async (fileUri: string) => {
  const filename = fileUri.split('/').pop();
  const fileType = 'audio/mpeg';
  const formData = new FormData();
  
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const file = new File([blob], filename || 'audio.mp3', { type: blob.type });
    formData.append('file', file);
  } else {
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: fileType,
    } as any);
  }

  try {
    // Step 1: Upload the audio file
    console.log('🔄 Step 1: Uploading audio to:', `${AI_BASE_URL}/upload`);
    const uploadResponse = await aiApi.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    console.log('✅ Step 1 complete - Upload response:', uploadResponse.data);
    const filePath = uploadResponse.data?.data?.file_path || uploadResponse.data?.file_path;
    
    if (!filePath) {
      throw new Error('Server did not return file_path from upload');
    }
    
    // Step 2: Transcribe the audio using the filePath
    console.log('🔄 Step 2: Transcribing audio with filePath:', filePath);
    const transcribeFormData = new FormData();
    transcribeFormData.append('file_path', filePath);
    
    const transcribeResponse = await aiApi.post('/transcribe-and-generate', transcribeFormData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('✅ Step 2 complete - Transcribe response:', transcribeResponse.data);
    
    const transcript = transcribeResponse.data?.data?.transcript || transcribeResponse.data?.transcript;
    if (!transcript) {
      throw new Error('Server did not return transcript');
    }
    
    // Step 3: Generate title and content from transcript
    console.log('🔄 Step 3: Generating news from transcript');
    const generateFormData = new FormData();
    generateFormData.append('transcript', transcript);
    
    const generateResponse = await aiApi.post('/polish-from-transcript', generateFormData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('✅ Step 3 complete - Generate response:', generateResponse.data);
    
    const title = generateResponse.data?.data?.title || '';
    const content = generateResponse.data?.data?.content || '';
    
    return { title, content, filePath };
    
  } catch (err: any) {
    console.error('❌ Audio processing failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// --- Audio Upload ---
// Step 1: Upload audio file to /upload endpoint
export const uploadAudio = async (fileUri: string) => {
  const filename = fileUri.split('/').pop();
  const fileType = 'audio/mpeg';
  const formData = new FormData();
  
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const file = new File([blob], filename || 'audio.mp3', { type: blob.type });
    formData.append('file', file);
  } else {
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: fileType,
    } as any);
  }

  try {
    console.log('🔄 Step 1: Uploading audio to:', `${AI_BASE_URL}/upload`);
    const response = await aiApi.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('✅ Upload response:', response.data);
    
    // Extract filePath from response
    const filePath = response.data?.filePath || response.data?.file_path || response.data?.data?.file_path;
    if (!filePath) {
      throw new Error('Server did not return filePath');
    }
    
    return { filePath };
  } catch (err: any) {
    console.error('❌ Audio upload failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// --- Audio Transcription ---
// Step 2: Transcribe audio using filePath from upload
export const transcribeAudioFile = async (filePath: string) => {
  try {
    console.log('🔄 Step 2: Transcribing audio with filePath:', filePath);
    const response = await aiApi.post('/transcribe', { filePath });
    console.log('✅ Transcription response:', response.data);
    
    const transcript = response.data?.transcript || response.data?.text;
    if (!transcript) {
      throw new Error('Server did not return transcript');
    }
    
    return { transcript };
  } catch (err: any) {
    console.error('❌ Transcription failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// --- Generate News from Transcript ---
// Step 3: Generate title and content from transcript
export const generateNewsFromTranscript = async (transcript: string) => {
  try {
    console.log('🔄 Step 3: Generating news from transcript');
    const response = await aiApi.post('/transcribe-and-generate', { transcript });
    console.log('✅ Generation response:', response.data);
    
    const title = response.data?.title || '';
    const content = response.data?.content || '';
    
    return { title, content };
  } catch (err: any) {
    console.error('❌ News generation failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// --- Audio Transcription (Legacy - Combined) ---
// Uses AI server for Whisper-based audio transcription
export const transcribeAudio = async (fileUri: string, category: string) => {
  const filename = fileUri.split('/').pop();
  const fileType = 'audio/mpeg';
  const formData = new FormData();
  
  if (Platform.OS === 'web') {
    // For web, fetch blob and create File object
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const file = new File([blob], filename || 'audio.mp3', { type: blob.type });
    formData.append('file', file);
  } else {
    // For native
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: fileType,
    } as any);
  }
  
  formData.append('category', category || 'General News');

  try {
    console.log('🔄 Transcribing audio with AI server:', `${AI_BASE_URL}/transcribe-and-generate`);
    const response = await aiApi.post('/transcribe-and-generate', formData, { 
      headers: { 'Content-Type': 'multipart/form-data' } 
    });
    console.log('✅ Transcription successful:', response.data);
    return response.data || { title: '', content: '' };
  } catch (err: any) {
    console.error('❌ Transcribe failed:', err?.response || err.message || err);
    throw err;
  }
};

// --- NEW: Function for Polishing Text ---
// Uses AI server for OpenAI-based text polishing
export const polishText = async (text: string, category: string, type: 'title' | 'description') => {
  const payload = { text, category: category || 'General News', type };

  try {
    console.log('🔄 Polishing text with AI server:', `${AI_BASE_URL}/polish`);
    console.log('📝 Payload:', payload);
    const response = await aiApi.post('/polish', payload);
    console.log('✅ Polish successful:', response.data);
    return response.data || { suggestions: [] };
  } catch (err: any) {
    console.error('❌ Polish failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// --- TEST: Transcribe with file_path ---
// Test transcription using file_path returned from upload
export const testTranscribeWithFilePath = async (filePath: string) => {
  const formData = new FormData();
  formData.append('file_path', filePath);

  try {
    console.log('🔄 Testing transcribe with file_path:', filePath);
    const response = await aiApi.post('/transcribe-and-generate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('✅ Transcribe test successful:', response.data);
    return response.data;
  } catch (err: any) {
    console.error('❌ Transcribe test failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

