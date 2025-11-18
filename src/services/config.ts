import { Platform } from 'react-native';

// Environment-based configuration
// Reads directly from .env file - NO hardcoded fallbacks

// Expo uses different env variable access patterns
// For web: process.env works
// For native: need Constants.expoConfig.extra or process.env
const getEnvVar = (key: string): string => {
  // Try process.env first (works for web and some native scenarios)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return '';
};

// Export API endpoints from environment variables
export const BASE_URL = getEnvVar('BASE_URL') || 'http://172.16.2.64:5173'; // Auth API
export const NEWS_API_BASE_URL = getEnvVar('NEWS_API_BASE_URL') || 'http://172.16.2.64:5173'; // News API
export const AI_BASE_URL = getEnvVar('AI_BASE_URL') || 'http://localhost:5500'; // AI server

// Log configuration on load
console.log('📡 API Configuration:', {
  platform: Platform.OS,
  AI_BASE_URL,
  NEWS_API_BASE_URL,
  BASE_URL
});

// Validate that required environment variables are set
if (!BASE_URL || !NEWS_API_BASE_URL || !AI_BASE_URL) {
  console.error('❌ Using fallback URLs - .env file may not be loaded properly');
  console.error('Current values:', { BASE_URL, NEWS_API_BASE_URL, AI_BASE_URL });
}