const axios = require('axios');

class ChatbotSession {
    constructor(onChunkReceived = null) {
        this.messages = [];
        this.onChunkReceived = onChunkReceived; // Callback for real-time updates
    }
    
    /**
     * Sends a text prompt (together with all previous prompts and answers) to Llama3 API.
     * @param {string} input New prompt.
     * @param {function} onChunkCallback Optional callback for real-time updates.
     * @returns {Promise<string>} Complete answer once finished.
     */
    async prompt(input, onChunkCallback = null) {
        // Use provided callback or the one from constructor
        const chunkCallback = onChunkCallback || this.onChunkReceived;
        
        this.messages.push({ role: "user", content: input });
        
        const data = {
            model: "llama3",
            messages: this.messages,
            stream: true // Explicitly set streaming mode
        };
        
        try {
            const response = await axios.post('http://localhost:11434/api/chat', data, {
                headers: { 'Content-Type': 'application/json' },
                responseType: 'stream' // Set responseType to stream
            });
            
            // Handle streaming response
            let fullResponse = "";
            
            return new Promise((resolve, reject) => {
                // Set up data handler for the stream
                response.data.on('data', (chunk) => {
                    try {
                        // Each chunk is a JSON string followed by a newline
                        const lines = chunk.toString().split('\n').filter(line => line.trim());
                        
                        for (const line of lines) {
                            if (!line) continue;
                            
                            const parsedChunk = JSON.parse(line);
                            
                            if (parsedChunk.message && parsedChunk.message.content) {
                                const contentChunk = parsedChunk.message.content;
                                // Add to the full response
                                fullResponse += contentChunk;
                                
                                // Call the callback with the latest chunk if provided
                                if (chunkCallback && typeof chunkCallback === 'function') {
                                    chunkCallback({
                                        chunk: contentChunk,
                                        fullResponse: fullResponse,
                                        done: parsedChunk.done || false
                                    });
                                }
                            }
                            
                            // If this is the last chunk, resolve the promise
                            if (parsedChunk.done === true) {
                                this.messages.push({ role: "assistant", content: fullResponse });
                                resolve(fullResponse);
                            }
                        }
                    } catch (error) {
                        console.error("Error parsing chunk:", error);
                    }
                });
                
                // Set up error handler for the stream
                response.data.on('error', (error) => {
                    console.error("Stream error:", error);
                    reject("Error: Stream interrupted.");
                });
                
                // Set up end handler in case 'done: true' is not received
                response.data.on('end', () => {
                    if (fullResponse) {
                        this.messages.push({ role: "assistant", content: fullResponse });
                        resolve(fullResponse);
                    } else {
                        reject("Error: Stream ended without a complete response.");
                    }
                });
            });
            
        } catch (error) {
            console.error("Error communicating with Llama3 API:", error);
            return "Error: Unable to get a response.";
        }
    }
}


module.exports = {
    ChatbotSession
};