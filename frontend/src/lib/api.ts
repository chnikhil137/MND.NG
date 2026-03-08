import axios from 'axios';
import { createClient } from './supabase';

const API_BASE = 'http://localhost:8000/api';

export const apiClient = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to inject Supabase JWT
apiClient.interceptors.request.use(async (config) => {
    if (typeof window !== 'undefined') {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token} `;
        }
    }
    return config;
});

export const mindEngineApi = {
    getCollections: async () => {
        const res = await apiClient.get('/collections');
        return res.data;
    },

    uploadDocuments: async (apiKey: string, dbId: string, files: File[]) => {
        const formData = new FormData();
        formData.append('api_key', apiKey);
        formData.append('db_id', dbId);
        files.forEach(file => formData.append('files', file));

        const res = await apiClient.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
    },

    queryEngine: async (apiKey: string, query: string) => {
        const res = await apiClient.post('/query', {
            api_key: apiKey,
            query: query,
        });
        return res.data;
    }
};
