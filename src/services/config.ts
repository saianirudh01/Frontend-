import { Platform } from 'react-native';

// Admin server API configuration (from API documentation)
const ADMIN_API_URL = "http://172.16.2.64:5000/api"; // Admin server (auth, news, reporters, approvers)
const NEWS_PROJECT_URL = "http://localhost:8082"; // News project backend running locally

export const BASE_URL = ADMIN_API_URL; // Auth API
export const NEWS_API_BASE_URL = ADMIN_API_URL; // News API
export const AI_BASE_URL = NEWS_PROJECT_URL; // AI features and media upload - now running locally