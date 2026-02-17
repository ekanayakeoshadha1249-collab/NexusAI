/*
 * Nexus AI - Main Logic Script
 * Handles UI interactions and AI processing
 */

let currentProvider = 'gemini';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Nexus AI Interface Loaded");

    // Initialize Lucide Icons
    lucide.createIcons();

    // Load Settings
    await loadSettings();

    // Load Chat History
    await loadChatHistory();
});

/* --- Settings Management --- */

function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    const content = modal.querySelector('div');

    if (modal.classList.contains('hidden')) {
        // Open
        modal.classList.remove('hidden');
        // Trigger reflow
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    } else {
        // Close
        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

function setProvider(provider) {
    currentProvider = provider;

    // Update UI
    const btnGemini = document.getElementById('btn-gemini');
    const btnOpenAI = document.getElementById('btn-openai');
    const modelInput = document.getElementById('model-name');

    if (provider === 'gemini') {
        btnGemini.className = 'px-3 py-2 rounded-md text-sm font-medium bg-brand-600 text-white transition-all';
        btnOpenAI.className = 'px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all';
        modelInput.placeholder = 'gemini-1.5-flash';
    } else {
        btnGemini.className = 'px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-all';
        btnOpenAI.className = 'px-3 py-2 rounded-md text-sm font-medium bg-brand-600 text-white transition-all';
        modelInput.placeholder = 'gpt-3.5-turbo';
    }
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('api-key');
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveSettings() {
    const apiKey = document.getElementById('api-key').value.trim();
    const modelName = document.getElementById('model-name').value.trim();

    if (!apiKey) {
        alert('Please enter a valid API Key.');
        return;
    }

    try {
        await db.settings.put({ key: 'api_provider', value: currentProvider });
        await db.settings.put({ key: 'api_key', value: apiKey });
        await db.settings.put({ key: 'model_name', value: modelName });

        // Show success feedback
        const saveBtn = document.querySelector('button[onclick="saveSettings()"]');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Saved!';
        saveBtn.classList.add('bg-green-600', 'hover:bg-green-500');
        lucide.createIcons();

        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.classList.remove('bg-green-600', 'hover:bg-green-500');
            lucide.createIcons();
            toggleSettings();
        }, 1500);

        console.log('Settings saved to Dexie DB');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. See console for details.');
    }
}

async function loadSettings() {
    try {
        const providerSetting = await db.settings.get('api_provider');
        const keySetting = await db.settings.get('api_key');
        const modelSetting = await db.settings.get('model_name');

        if (providerSetting) {
            setProvider(providerSetting.value);
        }

        if (keySetting) {
            document.getElementById('api-key').value = keySetting.value;
        }

        if (modelSetting) {
            document.getElementById('model-name').value = modelSetting.value;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function verifyConnection() {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) {
        alert("Please enter an API Key first.");
        return;
    }

    const btn = document.querySelector('button[onclick="verifyConnection()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = "Checking...";
    btn.disabled = true;

    if (currentProvider === 'gemini') {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || response.statusText);
            }

            // Connection successful!
            const modelNames = data.models.map(m => m.name.replace('models/', ''));
            console.log("Available Models:", modelNames);

            // Display for user debugging in Chat
            const modelListHtml = modelNames.map(m => `<code class="bg-black/30 px-1 py-0.5 rounded text-xs">${m}</code>`).join(' ');

            toggleSettings();
            addMessageToUI('system', `<strong>Connection Verified!</strong><br><br>Available Models for your key:<br>${modelListHtml}`);

            // Prioritize newer 2.x models
            const preferredModels = [
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-2.0-flash',
                'gemini-flash-latest',
                'gemini-1.5-flash'
            ];

            let bestModel = null;

            for (const pref of preferredModels) {
                if (modelNames.some(m => m === pref || m.includes(pref))) {
                    bestModel = pref;
                    break;
                }
            }

            if (!bestModel && data.models.length > 0) {
                const genModel = data.models.find(m => m.supportedGenerationMethods.includes('generateContent'));
                if (genModel) {
                    bestModel = genModel.name.replace('models/', '');
                }
            }

            if (bestModel) {
                document.getElementById('model-name').value = bestModel;

                await db.settings.put({ key: 'api_provider', value: currentProvider });
                await db.settings.put({ key: 'api_key', value: apiKey });
                await db.settings.put({ key: 'model_name', value: bestModel });

                addMessageToUI('system', `<strong>Auto-configured!</strong><br>Selected Model: <code class="text-brand-400">${bestModel}</code>`);
            } else {
                alert("Connection successful, but no standard models found. Check the chat window for the full list.");
            }

        } catch (error) {
            console.error("Verification Error:", error);
            alert(`Connection Failed: ${error.message}\n\nPlease check if your API Key is correct and from Google AI Studio.`);
        }
    } else {
        alert("Connection check currently optimized for Gemini. Please try a standard chat for OpenAI.");
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

/* --- Chat Logic --- */

let currentChatId = null;

function setInput(text) {
    const input = document.getElementById('chat-input');
    input.value = text;
    input.focus();
}

async function startNewChat() {
    currentChatId = null;
    document.getElementById('chat-container').innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4 animate-fade-in-up">
            <img src="logo.png" alt="Nexus AI" class="w-24 h-24 object-cover rounded-full drop-shadow-2xl mb-2 border-2 border-white/10">
            <div>
                <h2 class="text-xl font-bold text-white">New Chat Started</h2>
                <p class="text-sm mt-1">Configured with <span class="font-mono text-brand-400 capitalize">${currentProvider}</span></p>
            </div>
             <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-8">
                <button onclick="setInput('Explain how AI works')" class="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left text-sm transition-colors border border-white/5">Explain how AI works</button>
                <button onclick="setInput('Write a Python script for web scraping')" class="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-left text-sm transition-colors border border-white/5">Python script for scraping</button>
            </div>
        </div>
    `;
    lucide.createIcons();
    await loadChatHistory(); // Refresh to remove active state
}

async function loadChatHistory() {
    try {
        const chats = await db.chats.orderBy('updated_at').reverse().toArray();
        const list = document.getElementById('chat-history-list');

        if (chats.length === 0) {
            list.innerHTML = '<p class="text-center text-gray-500 text-sm mt-4">No recent chats</p>';
            return;
        }

        list.innerHTML = chats.map(chat => `
            <div onclick="loadChat(${chat.id})" 
                class="p-3 rounded-lg cursor-pointer hover:bg-white/5 transition-colors mb-1 group ${currentChatId === chat.id ? 'bg-white/10' : ''}">
                <div class="text-sm font-medium text-white truncate">${chat.title}</div>
                <div class="text-xs text-gray-500 mt-1 flex justify-between items-center">
                    <span>${new Date(chat.updated_at).toLocaleDateString()}</span>
                    <button onclick="deleteChat(event, ${chat.id})" class="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
        `).join('');

        lucide.createIcons();
    } catch (error) {
        console.error("Error loading history:", error);
    }
}

async function deleteChat(e, id) {
    e.stopPropagation();
    if (confirm('Delete this chat?')) {
        await db.chats.delete(id);
        await db.messages.where('chat_id').equals(id).delete();
        if (currentChatId === id) startNewChat();
        await loadChatHistory();
    }
}

async function loadChat(id) {
    currentChatId = id;
    const messages = await db.messages.where('chat_id').equals(id).sortBy('timestamp');

    // Clear Container
    const container = document.getElementById('chat-container');
    container.innerHTML = '';

    messages.forEach(msg => {
        addMessageToUI(msg.role, msg.content);
    });

    // Highlight active in history
    loadChatHistory();
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Clear input
    input.value = '';

    // Initialize Chat if new
    if (!currentChatId) {
        try {
            const id = await db.chats.add({
                title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
                created_at: Date.now(),
                updated_at: Date.now()
            });
            currentChatId = id;

            // Clear welcome screen
            const container = document.getElementById('chat-container');
            container.innerHTML = '';

            loadChatHistory();
        } catch (error) {
            console.error("Error creating chat:", error);
        }
    } else {
        // UI: Remove welcome screen if present (safeguard)
        const container = document.getElementById('chat-container');
        if (container.querySelector('.h-full')) {
            container.innerHTML = '';
        }
    }

    // Add User Message UI
    addMessageToUI('user', message);

    // Save User Message DB
    await db.messages.add({
        chat_id: currentChatId,
        role: 'user',
        content: message,
        timestamp: Date.now()
    });

    // Add Loading Indicator
    const loadingId = addLoadingIndicator();

    try {
        // Process Request
        const response = await processAIRequest(message);

        // Remove Loading
        removeLoadingIndicator(loadingId);

        // Add AI Response UI
        addMessageToUI('assistant', response);

        // Save Assistant Message DB
        await db.messages.add({
            chat_id: currentChatId,
            role: 'assistant',
            content: response,
            timestamp: Date.now()
        });

        // Update Chat Timestamp
        await db.chats.update(currentChatId, { updated_at: Date.now() });
        loadChatHistory(); // Refresh order

    } catch (error) {
        removeLoadingIndicator(loadingId);
        addMessageToUI('system', `Error: ${error.message}`);
    }
}

function addMessageToUI(role, content) {
    const container = document.getElementById('chat-container');
    const isUser = role === 'user';
    const isSystem = role === 'system';

    const div = document.createElement('div');
    div.className = `flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`;

    let innerHTML = '';

    if (isSystem) {
        innerHTML = `
            <div class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl max-w-3xl text-sm">
                <div class="flex items-center gap-2 mb-1 font-bold">
                    <i data-lucide="alert-circle" class="w-4 h-4"></i> System Alert
                </div>
                ${content}
            </div>
        `;
    } else if (isUser) {
        innerHTML = `
            <div class="max-w-2xl bg-brand-600 text-white px-5 py-3 rounded-2xl rounded-tr-sm shadow-md">
                <p class="whitespace-pre-wrap">${content}</p>
            </div>
        `;
    } else {
        // AI Message
        innerHTML = `
            <div class="flex gap-4 max-w-3xl w-full">
                <img src="logo.png" class="w-8 h-8 rounded-full object-cover bg-black/20 p-0.5 flex-shrink-0 border border-brand-500/30">
                <div class="bg-dark-surface border border-white/5 text-gray-200 px-5 py-3 rounded-2xl rounded-tl-sm shadow-sm w-full">
                    <div class="prose prose-invert prose-sm max-w-none">
                        <p class="whitespace-pre-wrap leading-relaxed">${content}</p>
                    </div>
                </div>
            </div>
        `;
    }

    div.innerHTML = innerHTML;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
}

function addLoadingIndicator() {
    const container = document.getElementById('chat-container');
    const id = 'loading-' + Date.now();

    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex justify-start animate-fade-in-up';
    div.innerHTML = `
        <div class="flex gap-4 max-w-3xl">
            <img src="logo.png" class="w-8 h-8 rounded-lg object-contain bg-black/20 p-0.5 flex-shrink-0">
            <div class="bg-dark-surface border border-white/5 px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
        </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeLoadingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

/* --- API Integration --- */

async function processAIRequest(prompt) {
    const settingKey = await db.settings.get('api_key');
    const settingModel = await db.settings.get('model_name');

    if (!settingKey || !settingKey.value) {
        throw new Error("API Key missing. Please set it in Settings.");
    }

    const apiKey = settingKey.value;
    const provider = currentProvider;
    let modelName = settingModel && settingModel.value ? settingModel.value : null;

    if (provider === 'gemini') {
        // Default to newer 2.5-flash model based on user logs
        let initialModel = modelName && modelName.trim().length > 0 ? modelName.trim() : 'gemini-2.5-flash';

        // Updated fallback list with models confirmed to exist in logs
        const fallbackModels = [
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-2.0-flash',
            'gemini-flash-latest',
            'gemini-1.5-flash' // Keep as last resort
        ];

        // Remove the initial model from fallbacks to avoid duplicate try
        const modelsToTry = [initialModel, ...fallbackModels.filter(m => m !== initialModel)];

        // Helper to perform the request
        const performRequest = async (currentModel) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
            console.log(`Trying Gemini Model: [${currentModel}]`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            return { response, data };
        };

        let lastError = null;
        let lastErrorStatus = null;

        // Iterate through models until one works
        for (const model of modelsToTry) {
            try {
                const result = await performRequest(model);

                if (result.response.ok) {
                    // Success!
                    // If we switched models, save the working one
                    if (model !== initialModel) {
                        console.log(`Auto-switching to working model: ${model}`);
                        await db.settings.put({ key: 'model_name', value: model });

                        // Notify user distinctively
                        addMessageToUI('system', `<strong>Auto-Recovered:</strong> Switched to '${model}'.`);

                        // Update UI input if settings is open
                        const modelInput = document.getElementById('model-name');
                        if (modelInput) modelInput.value = model;
                    }
                    return result.data.candidates[0].content.parts[0].text;
                } else {
                    // Failed - capture error to throw if all fail
                    lastError = result.data.error?.message || result.response.statusText;
                    lastErrorStatus = result.response.status;
                    console.warn(`Model [${model}] failed: ${lastErrorStatus}`);

                    // If proper 404 or 400 (Bad Request often means invalid model arg), continue to next model.
                    // If it's 403 (Permission) or 401 (Auth), retrying models won't help -> break.
                    if (lastErrorStatus !== 404 && lastErrorStatus !== 400 && lastErrorStatus !== 503) {
                        throw new Error(lastError); // Fatal auth error usually
                    }
                }
            } catch (err) {
                console.error(`Error trying [${model}]:`, err);
                // If it's a network error, we might want to continue, but usually fatal
                lastError = err.message;
            }
        }

        // If we get here, all models failed
        if (lastErrorStatus === 404) {
            throw new Error(`All models failed. Please Check Connection to auto-detect available models.`);
        }

        throw new Error(`Gemini Error: ${lastError || "Unknown error"}`);

    } else if (provider === 'openai') {
        const model = modelName || 'gpt-3.5-turbo';
        const url = 'https://api.openai.com/v1/chat/completions';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "OpenAI API Error");
        }

        return data.choices[0].message.content;
    }

    return "Provider not supported.";
}
