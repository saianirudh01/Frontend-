import axios from 'axios';
import { BASE_URL, AI_BASE_URL, NEWS_API_BASE_URL } from './config';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create an Axios instance to talk to your backend
const api = axios.create({
  baseURL: `${BASE_URL}/api`, // Add /api prefix to base URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create separate axios instance for news operations
const newsApi = axios.create({
  baseURL: `${NEWS_API_BASE_URL}/api`, // Add /api prefix to base URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance for media operations (without /api prefix)
const mediaApi = axios.create({
  baseURL: NEWS_API_BASE_URL, // No /api prefix - direct base URL
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
    console.log('📡 Submissions API response type:', typeof response.data);
    console.log('📡 Submissions API response:', response.data);
    
    const newsList = response.data;
    
    // Check if response is HTML (error case)
    if (typeof newsList === 'string' && newsList.includes('<!doctype html>')) {
      console.error('❌ API returned HTML instead of JSON - backend may not be running properly');
      throw new Error('Backend API is not responding correctly. Please check if the server is running.');
    }
    
    // Handle if response is not an array
    if (!Array.isArray(newsList)) {
      console.warn('⚠️ API did not return an array:', newsList);
      return [];
    }
    
    // Fetch media data to associate with news items
    let mediaMap = {};
    try {
      const mediaResponse = await newsApi.get('/media/');
      console.log('📡 Fetched media data:', mediaResponse.data.length, 'items');
      
      // Create a map of news_id to media info
      if (Array.isArray(mediaResponse.data)) {
        mediaResponse.data.forEach((media: any) => {
          if (media.news_id) {
            mediaMap[media.news_id] = {
              url: `${NEWS_API_BASE_URL}${media.file_path}`,
              type: media.media_type,
              thumbnail: media.thumbnail_path ? `${NEWS_API_BASE_URL}${media.thumbnail_path}` : null,
            };
          }
        });
      }
      console.log('📡 Created media map with', Object.keys(mediaMap).length, 'entries');
    } catch (mediaError) {
      console.warn('⚠️ Could not fetch media data:', mediaError);
    }
    
    // Transform admin API response to match app's Submission interface
    return newsList.map((item: any) => {
      const mediaInfo = mediaMap[item.news_id];
      return {
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
        mediaUrl: mediaInfo?.url || item.media_url || item.mediaUrl || null,
        mediaType: mediaInfo?.type || item.media_type || item.mediaType || null,
        location: item.location,
        reporterName: item.reporter_name
      };
    });
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
    
    // Check if response is HTML (error case)
    if (typeof response.data === 'string' && response.data.includes('<!doctype html>')) {
      console.error('❌ API returned HTML instead of JSON - backend may not be running properly');
      throw new Error('Backend API is not responding correctly. Please check if the server is running at ' + NEWS_API_BASE_URL);
    }
    
    // Admin API returns array of news items
    const newsList = response.data || [];
    
    if (!Array.isArray(newsList)) {
      console.error('❌ API response is not an array:', typeof newsList);
      throw new Error('Invalid API response format');
    }
    
    console.log('✅ Received', newsList.length, 'news items');
    
    // Fetch media information for all news items
    try {
      const mediaResponse = await newsApi.get('/media/');
      const mediaList = mediaResponse.data || [];
      console.log('📁 Received', mediaList.length, 'media files');
      
      // Create a map of news_id to media_url
      const mediaMap = new Map();
      if (Array.isArray(mediaList)) {
        mediaList.forEach((media: any) => {
          if (media.news_id && media.file_path) {
            mediaMap.set(media.news_id, {
              url: media.file_path,
              type: media.media_type || 'image'
            });
          }
        });
      }
      
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
// Calls POST /api/media/upload on News API server (uses mediaApi which has no /api prefix)
export const uploadMedia = async (fileUri: string, mediaType: 'image'|'video') => {
  try {
    console.log('🔄 Uploading media to News API server:', `${NEWS_API_BASE_URL}/api/media/upload`);
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
      
      // Create File object from blob
      const file = new File([blob], filename, { type: blob.type });
      formData.append('file', file);
      
      // Use fetch API to upload to News API server (with /api/media/upload path)
      console.log('🔄 Uploading to News API server:', `${NEWS_API_BASE_URL}/api/media/upload`);
      
      let uploadResponse;
      try {
        uploadResponse = await fetch(`${NEWS_API_BASE_URL}/api/media/upload`, {
          method: 'POST',
          body: formData,
          // Don't set Content-Type - browser will set it with boundary
        });
      } catch (networkError: any) {
        console.error('❌ Network error uploading media:', networkError);
        throw new Error(`Cannot connect to News API server at ${NEWS_API_BASE_URL}. Please ensure the News API server is running on port 5173.`);
      }
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', uploadResponse.status, errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      const data = await uploadResponse.json();
      console.log('📡 Server response:', data);
      
      // Extract media info from News API response
      // Response format: { message: "...", media: [{ media_id, media_type, file_path, thumbnail_path, original_name, size }] }
      const mediaItem = data?.media?.[0];
      if (!mediaItem || !mediaItem.file_path) {
        console.error('❌ Invalid upload response (missing media data):', data);
        throw new Error('Server did not return valid media data. Got: ' + JSON.stringify(data));
      }
      
      // Construct full media URL using NEWS_API_BASE_URL base + file_path
      const mediaUrl = `${NEWS_API_BASE_URL}${mediaItem.file_path}`;
      
      console.log('✅ Media uploaded:', mediaUrl);
      console.log('📋 Media details:', mediaItem);
      return { 
        mediaUrl, 
        filePath: mediaItem.file_path,
        mediaId: mediaItem.media_id,
        thumbnailPath: mediaItem.thumbnail_path,
        mediaType: mediaItem.media_type
      };
      
    } else {
      // For native platforms - use mediaApi for media upload
      const fileType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
      const filename = fileUri.split('/').pop() || 'media';
      
      formData.append('file', {
        uri: fileUri,
        name: filename,
        type: fileType,
      } as any);
      
      // Use mediaApi with /api/media/upload path
      console.log('🔄 Uploading to News API server:', `${NEWS_API_BASE_URL}/api/media/upload`);
      const uploadResponse = await mediaApi.post('/api/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('📡 Server response:', uploadResponse.data);
      
      // Extract media info from News API response
      const mediaItem = uploadResponse.data?.media?.[0];
      if (!mediaItem || !mediaItem.file_path) {
        console.error('❌ Invalid upload response (missing media data):', uploadResponse.data);
        throw new Error('Server did not return valid media data. Got: ' + JSON.stringify(uploadResponse.data));
      }
      
      // Construct full media URL
      const mediaUrl = `${NEWS_API_BASE_URL}${mediaItem.file_path}`;
      
      console.log('✅ Media uploaded:', mediaUrl);
      console.log('📋 Media details:', mediaItem);
      return { 
        mediaUrl, 
        filePath: mediaItem.file_path,
        mediaId: mediaItem.media_id,
        thumbnailPath: mediaItem.thumbnail_path,
        mediaType: mediaItem.media_type
      };
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
export const uploadAudio = async (fileUri: string, originalFilename?: string) => {
  const filename = originalFilename || fileUri.split('/').pop() || 'audio.mp3';
  const formData = new FormData();
  
  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    // Determine correct mime type based on file extension
    let mimeType = blob.type;
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'm4a') mimeType = 'audio/mp4';
    else if (ext === 'mp3') mimeType = 'audio/mpeg';
    else if (ext === 'wav') mimeType = 'audio/wav';
    else if (ext === 'ogg') mimeType = 'audio/ogg';
    else if (!mimeType.startsWith('audio/')) mimeType = 'audio/mpeg'; // Default to audio
    
    console.log('📁 Uploading audio file:', filename, 'Type:', mimeType, 'Size:', blob.size);
    
    const file = new File([blob], filename, { type: mimeType });
    formData.append('file', file);
  } else {
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: 'audio/mpeg',
    } as any);
  }

  try {
    console.log('🔄 Step 1: Uploading audio to:', `${AI_BASE_URL}/upload`);
    console.log('📦 FormData contains file:', filename);
    
    const response = await aiApi.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Prevent caching
      params: { _t: Date.now() }
    });
    console.log('✅ Upload response:', response.data);
    console.log('📂 Response data structure:', JSON.stringify(response.data, null, 2));
    
    // Extract filePath from response - server returns data.file_path
    const filePath = response.data?.data?.file_path || response.data?.file_path || response.data?.filePath;
    if (!filePath) {
      console.error('❌ Server response:', JSON.stringify(response.data, null, 2));
      throw new Error('Server did not return file_path. Check server response above.');
    }
    
    console.log('✅ Extracted file path:', filePath);
    console.log('🔍 File extension check:', filePath.split('.').pop());
    
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
    const formData = new FormData();
    formData.append('file_path', filePath);
    
    const response = await aiApi.post('/transcribe-and-generate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('✅ Transcription response:', response.data);
    
    const transcript = response.data?.data?.transcript || response.data?.transcript;
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
    const formData = new FormData();
    formData.append('transcript', transcript);
    
    const response = await aiApi.post('/polish-from-transcript', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('✅ Generation response:', response.data);
    
    const title = response.data?.data?.title || response.data?.title || '';
    const content = response.data?.data?.content || response.data?.content || '';
    
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

// --- NEWS MANAGEMENT API FUNCTIONS ---

// TypeScript interfaces for News Management
export interface NewsData {
  journalist_id: string;
  news_title: string;
  news_description: string;
  category_id: number;
  sub_category_name?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  media_url?: string;
  media_type?: string;
}

export interface CreateNewsResponse {
  news_id: string;
  message: string;
  status: string;
  sub_category_id: number;
  assignment: {
    message: string;
    approver1: {
      id: string;
      name: string;
      pending_count: number;
    };
    approver2: {
      id: string;
      name: string;
      pending_count: number;
    };
    notificationSent: boolean;
  };
}

export interface NewsItem {
  news_id: string;
  news_title: string;
  news_description: string;
  category_id: number;
  category_name: string;
  status_code: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';
  creation_date: string;
  published_date: string | null;
  journalist_id: string;
  reporter_name: string;
  approver1_id: string;
  approver2_id: string;
  approver1_name: string;
  approver2_name: string;
  approver1_status: string;
  approver2_status: string;
  sub_category_name?: string;
  location?: string;
  media_url?: string;
  media_type?: string;
}

// Create news (creates as PENDING and auto-assigns approvers)
export const createNews = async (data: NewsData): Promise<CreateNewsResponse> => {
  try {
    console.log('🔄 Creating news (will be PENDING with auto-assignment):', data);
    const response = await newsApi.post('/news', data);
    console.log('✅ News created:', response.data);
    console.log('✅ Assignment info:', response.data.assignment);
    return response.data;
  } catch (err: any) {
    console.error('❌ Create news failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// Update news
export const updateNews = async (data: Partial<NewsData> & { news_id: string; status_code?: string }): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🔄 Updating news:', data);
    const response = await newsApi.post('/news/update', data);
    console.log('✅ News updated:', response.data);
    return response.data;
  } catch (err: any) {
    console.error('❌ Update news failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// Submit news for approval (for DRAFT news, moves to PENDING)
export const submitNewsForApproval = async (newsId: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🔄 Submitting news for approval:', newsId);
    const response = await newsApi.post('/news/submit', { news_id: newsId });
    console.log('✅ News submitted:', response.data);
    return response.data;
  } catch (err: any) {
    console.error('❌ Submit news failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// Fetch all news by journalist ID
export const fetchNewsByJournalist = async (journalistId: string): Promise<NewsItem[]> => {
  try {
    console.log('🔄 Fetching news for journalist:', journalistId);
    const response = await newsApi.get(`/news/by-journalist/${journalistId}`);
    console.log('✅ News fetched:', response.data);
    
    const newsList = Array.isArray(response.data) ? response.data : [];
    
    // Fetch media data to associate with news items
    let mediaMap = {};
    try {
      const mediaResponse = await newsApi.get('/media/');
      console.log('📡 Fetched media data:', mediaResponse.data.length, 'items');
      
      // Create a map of news_id to media info
      if (Array.isArray(mediaResponse.data)) {
        mediaResponse.data.forEach((media: any) => {
          if (media.news_id) {
            mediaMap[media.news_id] = {
              url: `${NEWS_API_BASE_URL}${media.file_path}`,
              type: media.media_type,
              thumbnail: media.thumbnail_path ? `${NEWS_API_BASE_URL}${media.thumbnail_path}` : null,
            };
          }
        });
      }
      console.log('📡 Created media map with', Object.keys(mediaMap).length, 'entries');
    } catch (mediaError) {
      console.warn('⚠️ Could not fetch media data:', mediaError);
    }
    
    // Merge media data with news items
    return newsList.map((item: any) => {
      const mediaInfo = mediaMap[item.news_id];
      return {
        ...item,
        media_url: mediaInfo?.url || item.media_url || null,
        media_type: mediaInfo?.type || item.media_type || null,
      };
    });
  } catch (err: any) {
    console.error('❌ Fetch news failed:', err?.response?.data || err.message || err);
    throw err;
  }
};

// Helper function to get status color
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'DRAFT':
      return '#9E9E9E'; // Gray
    case 'PENDING':
      return '#FFC107'; // Yellow/Amber
    case 'APPROVED':
      return '#2196F3'; // Blue
    case 'PUBLISHED':
      return '#4CAF50'; // Green
    case 'REJECTED':
      return '#F44336'; // Red
    default:
      return '#9E9E9E';
  }
};

// Helper function to get status text
export const getStatusText = (status: string): string => {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'PENDING':
      return 'Pending Review';
    case 'APPROVED':
      return 'Approved';
    case 'PUBLISHED':
      return 'Published';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
};

