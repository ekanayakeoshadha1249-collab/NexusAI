/* 
 * Nexus AI - Database Configuration
 * Uses Dexie.js for IndexedDB management
 */

const db = new Dexie('NexusAI_DB');

// Define Database Schema
db.version(1).stores({
    // Store settings including API keys
    settings: 'key',
    // Chat history storage
    chats: '++id, title, created_at, updated_at',
    messages: '++id, chat_id, role, content, timestamp'
});

console.log("Nexus AI Database Initialized");
