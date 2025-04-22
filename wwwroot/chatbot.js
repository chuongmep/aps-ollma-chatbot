export function initChatbot(container, urn) {
    container.innerHTML = `
        <div style="width: 100%; height: 100%;">
            <div id="chatbot-history" style="position: relative; top: 0; left: 0; right: 0; height: 80%; overflow-y: auto; display: flex; flex-flow: column nowrap;">
            </div>
            <div id="chatbot-prompt" style="position: relative; left: 0; right: 0; bottom: 0; height: 20%; overflow-y: hidden; display: flex; flex-flow: column nowrap;">
                <textarea id="chatbot-input" style="margin: 0.5em; margin-bottom: 0; height: 100%;">What is the average area of all objects?</textarea>
                <sl-button id="chatbot-send" variant="primary" style="margin: 0.5em;">Send</sl-button>
            </div>
        </div>
    `;
    const input = document.getElementById("chatbot-input");
    const button = document.getElementById("chatbot-send");
    const history = document.getElementById("chatbot-history");
    
    // Store the current eventSource to manage it properly
    let currentEventSource = null;
    
    button.addEventListener("click", async function () {
        // Close any existing EventSource connection
        if (currentEventSource) {
            console.log("Closing previous EventSource connection");
            currentEventSource.close();
            currentEventSource = null;
        }
        
        const prompt = input.value;
        if (!prompt.trim()) return; // Don't process empty prompts
        
        addLogEntry("User", prompt);
        input.value = "";
        input.setAttribute("disabled", "true");
        button.innerText = "Thinking...";
        button.setAttribute("disabled", "true");
        
        // Create a new card for the assistant's response
        const assistantCard = createCard("Assistant", "");
        history.appendChild(assistantCard);
        history.scrollTop = history.scrollHeight;
        
        // Create a new EventSource for this question
        console.log(`Creating new EventSource for urn: ${urn}`);
        currentEventSource = new EventSource(`/events/${urn}`);
        
        // Set up event handlers
        currentEventSource.onmessage = function(event) {
            try {
                const update = JSON.parse(event.data);
                console.log("Received SSE update:", update);
                
                // Update the message content
                if (update.chunk) {
                    updateAssistantMessage(assistantCard, update.chunk);
                    history.scrollTop = history.scrollHeight;
                }
                
                // Check if this is the final message
                if (update.done) {
                    console.log("Stream completed, closing connection");
                    resetUI();
                }
            } catch (error) {
                console.error("Error processing SSE message:", error);
            }
        };
        
        currentEventSource.onerror = function(event) {
            console.error("EventSource error:", event);
            resetUI();
        };
        
        // Set a timeout to ensure UI resets even if something goes wrong
        const resetTimeout = setTimeout(() => {
            console.log("Reset timeout triggered after 30 seconds");
            resetUI();
        }, 30000);
        
        // Function to reset the UI state
        function resetUI() {
            if (currentEventSource) {
                currentEventSource.close();
                currentEventSource = null;
            }
            
            input.removeAttribute("disabled");
            button.innerText = "Send";
            button.removeAttribute("disabled");
            clearTimeout(resetTimeout);
        }
        
        try {
            console.log("Sending prompt to chatbot:", prompt);
            
            // Submit the prompt to the server
            const response = await submitPrompt(urn, prompt);
            console.log("Regular API response received:", response);
            
            // If we didn't get streaming updates but got a response here,
            // update the card with the full response
            if (!assistantCard.querySelector('.message-content').textContent.trim() && response) {
                updateAssistantMessage(assistantCard, response);
                history.scrollTop = history.scrollHeight;
            }
        } catch (error) {
            console.error("Error processing prompt:", error);
            updateAssistantMessage(assistantCard, "Error: Unable to process your question.");
            alert("Error: " + error.message);
        } finally {
            resetUI();
        }
    });
}

async function submitPrompt(urn, question) {
    try {
        console.log(`Submitting prompt to /prompt/${urn}`);
        const resp = await fetch(`/prompt/${urn}`, {
            method: "post",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });
        
        if (resp.ok) {
            const data = await resp.json();
            console.log("Prompt response received:", data);
            return data.answer;
        } else {
            const errorText = await resp.text();
            throw new Error(errorText || `Server error: ${resp.status}`);
        }
    } catch (error) {
        console.error("Error in submitPrompt:", error);
        throw error;
    }
}

function addLogEntry(title, message) {
    const card = createCard(title, message);
    const history = document.getElementById("chatbot-history");
    history.appendChild(card);
    history.scrollTop = history.scrollHeight;
}

function createCard(title, message) {
    const card = document.createElement("sl-card");
    card.classList.add("card-header");
    card.style.margin = "0.5em";
    card.style.width = "100%";
    
    // Process message for model references
    const processedMessage = processMessage(message);
    
    card.innerHTML = `
        <div slot="header">${title}</div>
        <div class="message-content">${processedMessage}</div>
    `;
    return card;
}

function updateAssistantMessage(card, chunk) {
    if (!chunk) return;
    
    // Get the message content div
    const contentDiv = card.querySelector('.message-content');
    if (!contentDiv) {
        console.error("Message content div not found in card:", card);
        return;
    }
    
    // Process the chunk for model references
    const processedChunk = processMessage(chunk);
    
    // Append the processed chunk to the existing content
    contentDiv.innerHTML += processedChunk;
}

function processMessage(message) {
    if (!message) return "";
    
    // Convert model references to clickable links
    return message.replaceAll(/\[(\d+)(,\s+\d+)*\]/g, function(match) {
        try {
            const dbids = JSON.parse(match);
            return `<a href="#" data-dbids="${dbids.join(",")}">${match}</a>`;
        } catch (error) {
            console.error("Error processing model reference:", error);
            return match;
        }
    });
}