import React, { useState, useEffect, useRef } from 'react';

const StarterScriptGeneratorApp = () => {
  // State to store chat messages (user and agent responses)
    // Each message object contains sender, type (text, html, image, or codeBlocks), and content
    const [messages, setMessages] = useState([]);
    // State to hold the current message typed by the user (now plain text again)
    const [currentMessage, setCurrentMessage] = useState('');

    // Hardcode the Azure AI Foundry Agent ID, API URL, and API Key
    // IMPORTANT: For production environments, consider more secure ways to manage these credentials
    //const agentId = "asst_5LTes74dVyYVWr5BsORp6aSz"; // <<< REPLACE WITH YOUR AGENT ID
    const apiUrl = import.meta.env.VITE_AGENT_ENDPOINT;   // <<< REPLACE WITH YOUR API URL (e.g., https://yourendpoint.azure.com/predict)
    
    const apiKey = import.meta.env.VITE_API_KEY;    
    // State for selected technology combination from dropdown
    // Initialize from localStorage or with a default value
    const [selectedTechnology, setSelectedTechnology] = useState(() => {
        const savedTech = localStorage.getItem('selectedTechnology');
        return savedTech || 'Selenium with TestNG and Java';
    });

    // State for managing copy button feedback (temporary)
    const [copiedKey, setCopiedKey] = useState(null);

    // State for modal visibility and content (for post-download confirmation)
    const [showDownloadConfirmationModal, setShowDownloadConfirmationModal] = useState(false);
    const [downloadedFilename, setDownloadedFilename] = useState('');

    // New state for Clear Chat confirmation modal
    const [showClearChatConfirmationModal, setShowClearChatConfirmationModal] = useState(false);

    // State for detailed loading messages
    const [loadingMessage, setLoadingMessage] = useState('');

    // State to store the uploaded HTML content and name (now an array)
    const [uploadedHtmlFiles, setUploadedHtmlFiles] = useState([]); // Array of { id: string, name: string, content: string }
    // State to store the uploaded image data (base64) and name (now an array)
    const [uploadedImageFiles, setUploadedImageFiles] = useState([]); // Array of { id: string, name: string, content: string }

    // State to control the visibility of file upload buttons
    const [isHiding, setIsHiding] = useState(false); // Changed to false to show the buttons

    // Ref for file input elements to clear their value
    const htmlInputRef = useRef(null);
    const imageInputRef = useRef(null);

    // Define a list of keywords relevant to automation and programming to check user input
    // This list is expanded to cover common automation and programming terms.
    const automationKeywords = [
        "click", "input", "text", "enter", "type", "submit", "button", "link", "form", "login", "logout",
        "navigate", "open", "go to", "url", "verify", "assert", "check", "select", "dropdown", "checkbox",
        "radio", "element", "locator", "xpath", "css", "id", "name", "class", "tag", "attribute",
        "test case", "scenario", "feature", "step", "given", "when", "then", "and", "but",
        "page object", "pom", "driver", "browser", "webdriver", "selenium", "testng", "junit",
        "cucumber", "gherkin", "specflow", "python", "java", "c#", "javascript", "typescript",
        "playwright", "cypress", "robot framework", "appium", "mobile", "android", "ios",
        "webdriverio", "karate dsl", "api", "request", "response", "json", "xml", "data", "file",
        "upload", "download", "wait", "explicit wait", "implicit wait", "fluent wait", "screenshot",
        "report", "log", "exception", "error", "handle", "try catch", "finally", "setup", "teardown",
        "before", "after", "test", "method", "function", "class", "interface", "package", "import",
        "public", "private", "protected", "static", "void", "string", "int", "boolean", "true", "false",
        "loop", "if", "else", "switch", "case", "array", "list", "map", "object", "console", "print",
        "test script", "automation script", "write code", "generate code", "script for", "automate",
        "web page", "application", "ui", "api testing", "end-to-end", "integration test", "unit test",
        "data-driven", "parameterize", "assertion", "headless", "browser context", "fixture", "hook",
        "runner", "report", "debug", "trace", "parallel execution", "cross-browser", "mobile automation",
        "desktop automation", "accessibility", "performance", "security testing", "load testing",
        "stress testing", "mock", "stub", "spy", "expect", "should", "given when then", "background",
        "scenario outline", "examples", "datatable", "tags", "hooks", "step definition", "feature file",
        "page factory", "element locator", "by id", "by name", "by classname", "by tagname", "by linktext",
        "by partiallinktext", "by xpath", "by cssselector", "find element", "find elements", "sendkeys",
        "get text", "get attribute", "is displayed", "is enabled", "is selected", "alert", "frame",
        "window handle", "cookies", "local storage", "session storage", "javascript executor", "actions class",
        "robot", "keyword", "resource", "variables", "library", "listener", "log level", "run keyword",
        "appium driver", "desired capabilities", "mobile element", "touch action", "swipe", "scroll",
        "install app", "uninstall app", "start activity", "wait for element", "implicit wait", "explicit wait",
        "fluent wait", "page object model", "test runner", "test suite", "test plan", "test report",
        "build tool", "maven", "gradle", "npm", "yarn", "nuget", "dotnet", "visual studio", "intellij",
        "eclipse", "vscode", "ide", "debugger", "version control", "git", "github", "gitlab", "bitbucket",
        "ci/cd", "jenkins", "azure devops", "github actions", "gitlab ci", "travis ci", "circleci",
        "docker", "kubernetes", "cloud", "aws", "azure", "gcp", "saucelabs", "browserstack", "lambda test"
    ];

    // Helper function to check if text contains any of the defined keywords
    const containsRelevantKeywords = (text, keywords) => {
        const lowerText = text.toLowerCase();
        // Check if any keyword is present in the text
        return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
    };


    // Function to generate dynamic system instructions based on selected technology
    const getSystemInstructions = (tech) => {
        switch (tech) {
            case 'Selenium with TestNG and Java':
                return `You are a highly skilled Selenium TestNG and Java automation engineer. Generate practical, optimized, and production-ready automation scripts (Page Object Model classes and TestNG test classes) from user's test case details. Prioritize robust locators (CSS, ID, Name, then XPath) from provided HTML. Include explicit waits, comprehensive error handling, and standard TestNG assertions. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`java\\n// Page Class: MyPage.java\\n...code...\\n\`\`\` and \`\`\`java\\n// Test Class: MyTest.java\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Selenium with Cucumber and Java':
                return `You are a highly skilled Selenium BDD Cucumber and Java automation engineer. Generate optimized and practical Cucumber feature files, step definitions, and corresponding Page Object Model classes. Utilize provided HTML for precise locators (CSS, ID, Name, then XPath). Include necessary imports, comprehensive error handling, and best practices for BDD. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`gherkin\\n// Feature File: MyFeature.feature\\n...feature...\\n\`\`\` and \`\`\`java\\n// Step Definitions: MySteps.java\\n...steps...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Selenium with Specflow and C#':
                return `You are a highly skilled Selenium BDD SpecFlow and C# automation engineer. Generate optimized and practical SpecFlow feature files, step definitions, and corresponding Page Object Model classes. Utilize provided HTML for precise locators (CSS, ID, Name, then XPath). Include necessary imports, comprehensive error handling, and best practices for BDD. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`gherkin\\n// Feature File: MyFeature.feature\\n...feature...\\n\`\`\` and \`\`\`csharp\\n// Step Definitions: MySteps.cs\\n...steps...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Selenium with Python':
                return `You are a highly skilled Selenium Python automation engineer. Generate practical, optimized, and production-ready Selenium Python test scripts. Prioritize robust locators (CSS, ID, Name, then XPath) from provided HTML. Include explicit waits, comprehensive error handling, and standard Python testing assertions. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`python\\n// Test Script: my_test.py\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Playwright with JavaScript':
                return `You are a highly skilled Playwright JavaScript automation engineer. Generate practical, optimized, and production-ready Playwright test scripts. Utilize provided HTML for precise selectors (CSS, ID, Name, Text, then XPath). Include necessary Playwright assertions, comprehensive error handling, and best practices. Mark dummy selectors clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`javascript\\n// Test Script: myTest.spec.js\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Playwright with TypeScript':
                return `You are a highly skilled Playwright TypeScript automation engineer. Generate practical, optimized, and production-ready Playwright test scripts, fully leveraging TypeScript features (e.g., type definitions, interfaces). Utilize provided HTML for precise selectors (CSS, ID, Name, Text, then XPath). Include necessary Playwright assertions, comprehensive error handling, and best practices. Mark dummy selectors clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`typescript\\n// Test Script: myTest.spec.ts\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Playwright with C#':
                return `You are a highly skilled Playwright C# automation engineer. Generate practical, optimized, and production-ready Playwright C# test scripts. Utilize provided HTML for precise selectors (CSS, ID, Name, Text, then XPath). Include necessary Playwright assertions, comprehensive error handling, and best practices. Mark dummy selectors clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`csharp\\n// Test Script: MyTest.cs\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Cypress with JavaScript':
                return `You are a highly skilled Cypress JavaScript automation engineer. Generate practical, optimized, and production-ready Cypress test scripts. Utilize provided HTML for precise selectors (CSS, ID, Class, Text). Include necessary Cypress assertions, comprehensive error handling, and best practices. Mark dummy selectors clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`javascript\\n// Test Script: my_spec.cy.js\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Robot Framework with Python':
                return `You are a highly skilled Robot Framework automation engineer. Generate practical, optimized, and production-ready Robot Framework test cases (.robot files) and associated resource files. Utilize provided HTML for precise locators. Include necessary keywords, comprehensive error handling, and best practices. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`robotframework\\n// Test Case: my_test_case.robot\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Appium with Java':
                return `You are a highly skilled Appium Java automation engineer. Generate practical, optimized, and production-ready mobile automation scripts for Android/iOS. Utilize provided screen XML/HTML for precise locators (e.g., Accessibility IDs, XPaths, UIAutomator, AndroidViewTag). Include necessary Appium assertions, comprehensive error handling, and best practices. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`java\\n// Test Script: MobileTest.java\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Selenium with JUnit and Java':
                return `You are a highly skilled Selenium JUnit and Java automation engineer. Generate practical, optimized, and production-ready automation scripts (Page Object Model classes and JUnit test classes) from user's test case details. Prioritize robust locators (CSS, ID, Name, then XPath) from provided HTML. Include explicit waits, comprehensive error handling, and standard JUnit assertions. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`java\\n// Page Class: MyPage.java\\n...code...\\n\`\`\` and \`\`\`java\\n// Test Class: MyTest.java\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'WebdriverIO with JavaScript':
                return `You are a highly skilled WebdriverIO JavaScript automation engineer. Generate practical, optimized, and production-ready WebdriverIO test scripts. Utilize provided HTML for precise selectors. Include necessary WebdriverIO assertions, comprehensive error handling, and best practices. Mark dummy selectors clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`javascript\\n// Test Script: my_test.js\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'WebdriverIO with TypeScript':
                return `You are a highly skilled WebdriverIO TypeScript automation engineer. Generate practical, optimized, and production-ready WebdriverIO test scripts, fully leveraging TypeScript features (e.g., type definitions, interfaces). Utilize provided HTML for precise selectors. Include necessary WebdriverIO assertions, comprehensive error handling, and best practices. Mark dummy selectors clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`typescript\\n// Test Script: my_test.ts\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Appium with Python':
                return `You are a highly skilled Appium Python automation engineer. Generate practical, optimized, and production-ready mobile automation scripts for Android/iOS using Appium Python client. Utilize provided screen XML/HTML for precise locators (e.g., Accessibility IDs, XPaths, UIAutomator, AndroidViewTag). Include necessary Appium assertions, comprehensive error handling, and best practices. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`python\\n// Test Script: mobile_test.py\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            case 'Karate DSL':
                return `You are a highly skilled Karate DSL automation engineer. Generate practical, optimized, and production-ready Karate DSL feature files for API and/or UI automation. If HTML is provided, find locators. Include necessary Karate assertions, comprehensive error handling, and best practices. Mark dummy locators clearly with comments. Provide only the code, formatted as Markdown code blocks (e.g., \`\`\`gherkin\\n// Feature File: my_api.feature\\n...code...\\n\`\`\`), no conversational text, unless a crucial clarifying question is essential.`;
            default:
                return `You are a highly skilled Test Automation Expert. Generate practical, optimized, and production-ready automation scripts based on user input. If HTML is provided, find locators. Include best practices and mark dummy locators. Provide only the code, formatted as Markdown code blocks, no conversational text, unless a crucial clarifying question is essential.`;
        }
    };

    // State to indicate if the agent is currently processing a request
    const [isProcessing, setIsProcessing] = useState(false);

    // Ref for the messages container to enable auto-scrolling
    const messagesEndRef = useRef(null);

    // Effect to scroll to the bottom of the chat history whenever messages change
    // This effect now only triggers when the number of messages changes,
    // ensuring it doesn't scroll when only a property like 'isDownloaded' is updated.
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]); // Dependency changed to messages.length


    // Effect to save selectedTechnology to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('selectedTechnology', selectedTechnology);
    }, [selectedTechnology]);

    // Effect to dynamically load JSZip
    useEffect(() => {
        const scriptId = 'jszip-script';
        // Check if the script is already loaded
        if (document.getElementById(scriptId)) {
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js";
        script.async = true;
        script.onload = () => console.log('JSZip loaded successfully!');
        script.onerror = () => console.error('Failed to load JSZip script!');
        document.head.appendChild(script);

        // Cleanup function to remove the script when the component unmounts
        return () => {
            const existingScript = document.getElementById(scriptId);
            if (existingScript) {
                document.head.removeChild(existingScript);
            }
        };
    }, []); // Empty dependency array ensures this runs only once on mount


    /**
     * Extracts the language from a markdown code block string.
     * E.g., "```java\ncode..." returns "java"
     */
    const extractLanguage = (text) => {
        const match = text.match(/^```(\w+)\n/);
        return match ? match[1] : '';
    };

    /**
     * Cleans the code string by removing markdown fences.
     */
    const cleanCode = (text) => {
        // This function now expects to receive a single code block string
        return text.replace(/^```(\w+)?\n/, '').replace(/```$/, '').trim();
    };

    /**
     * Parses the agent's response text to extract individual code blocks.
     * Assumes code blocks are delimited by ``` and can have a language specifier.
     * Attempts to infer a filename from comments like "// Page Class: MyPage.java"
     * @param {string} fullText The full response text from the agent.
     * @returns {Array<{language: string, content: string, filename: string, isDownloaded: boolean}>} An array of parsed code blocks.
     */
    const parseCodeBlocks = (fullText) => {
        const codeBlocks = [];
        const regex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        let blockCount = 0;

        while ((match = regex.exec(fullText)) !== null) {
            const language = match[1] || 'text'; // Default to 'text' if no language specified
            const codeContent = match[2].trim();
            blockCount++;

            let suggestedFilename = `code_block_${blockCount}`; // Default generic name
            let fileExtension = 'txt'; // Default extension

            // Determine file extension based on language
            const extMap = {
                'java': 'java', 'converted_java': 'java', 'python': 'py', 'csharp': 'cs', 'javascript': 'js',
                'typescript': 'ts', 'gherkin': 'feature', 'robotframework': 'robot',
                'text': 'txt'
            };
            fileExtension = extMap[language] || 'txt';

            // Attempt to infer filename from comments like "// Page Class: LoginPage.java"
            // This regex is improved to capture more general file paths from comments
            const filenameMatch = codeContent.match(/^\/\/\s*(?:File|Page Class|Test Class|Feature File|Test Script|Step Definitions):\s*([a-zA-Z0-9_\-\/\.]+\.(java|py|cs|js|ts|robot|feature|txt))\s*$/m);
            if (filenameMatch && filenameMatch[1]) {
                suggestedFilename = filenameMatch[1];
            } else {
                // If no specific name found, use generic name with correct extension
                suggestedFilename = `generated_script_${blockCount}.${fileExtension}`;
            }

            codeBlocks.push({
                language: language,
                content: codeContent,
                filename: suggestedFilename,
                isDownloaded: false // Initialize as not downloaded
            });
        }
        return codeBlocks;
    };


    /**
     * Copies text to the clipboard using document.execCommand.
     * @param {string} text The text to copy.
     * @param {string} key A unique key for the copied block to show feedback.
     */
    const copyToClipboard = (text, key) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            setCopiedKey(key); // Use the key for feedback
            setTimeout(() => setCopiedKey(null), 2000); // Clear feedback after 2 seconds
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
        document.body.removeChild(textarea);
    };

    /**
     * Downloads code content as a file and then shows a confirmation modal.
     * @param {string} content The code content to download.
     * @param {string} filename The suggested filename for the download.
     * @param {number} messageIndex The index of the message containing this block.
     * @param {number} blockIndex The index of the block within the message.
     */
    const downloadCodeAsFile = (content, filename, messageIndex, blockIndex) => {
        // Update the message state to mark this specific block as downloaded
        setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            // Deep copy the message and its codeBlocks to ensure immutability
            const messageToUpdate = { ...newMessages[messageIndex] };
            messageToUpdate.codeBlocks = messageToUpdate.codeBlocks.map((block, idx) =>
                idx === blockIndex ? { ...block, isDownloaded: true } : block
            );
            newMessages[messageIndex] = messageToUpdate;
            return newMessages;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url); // Clean up the object URL

        // Show the download confirmation modal
        setDownloadedFilename(filename);
        setShowDownloadConfirmationModal(true);
    };

    /**
     * Closes the download confirmation modal.
     */
    const closeDownloadConfirmationModal = () => {
        setShowDownloadConfirmationModal(false);
        setDownloadedFilename('');
    };

    /**
     * Opens the Clear Chat confirmation modal.
     */
    const confirmClearChat = () => {
        setShowClearChatConfirmationModal(true);
    };

    /**
     * Executes clearing all messages from the chat history.
     */
    const executeClearChat = () => {
        setMessages([]);
        setCopiedKey(null);
        setDownloadedFilename('');
        setShowDownloadConfirmationModal(false);
        setUploadedHtmlFiles([]); // Clear array
        setUploadedImageFiles([]); // Clear array
        if (htmlInputRef.current) htmlInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
        setShowClearChatConfirmationModal(false); // Close the clear chat modal
    };

    /**
     * Cancels clearing the chat from the modal.
     */
    const cancelClearChat = () => {
        setShowClearChatConfirmationModal(false);
    };

    /**
     * Downloads all generated code blocks as a single ZIP file.
     */
    const handleDownloadAllAsZip = async () => {
        // Ensure JSZip is available globally
        if (typeof window.JSZip === 'undefined') {
            alert('JSZip library is not loaded. Please try again in a moment, or refresh the page.');
            console.error('JSZip library is not available globally (window.JSZip is undefined).');
            return;
        }

        const zip = new window.JSZip(); // Use window.JSZip
        let hasCode = false;

        // Iterate through all messages to find code blocks
        messages.forEach((msg) => {
            if (msg.type === 'codeBlocks' && msg.sender === 'agent' && msg.codeBlocks && msg.codeBlocks.length > 0) {
                msg.codeBlocks.forEach((block) => {
                    // Use the filename property to define the path within the ZIP
                    // Ensure the filename is not empty or just an extension
                    const filename = block.filename && block.filename.trim() !== '' ? block.filename : `generated_script_${Date.now()}.txt`;
                    zip.file(filename, block.content);
                    hasCode = true;
                });
            }
        });

        if (!hasCode) {
            alert('No automation scripts to download. Please generate some scripts first.');
            return;
        }

        // Set processing state for ZIP generation
        setLoadingMessage("Preparing ZIP file...");
        setIsProcessing(true);
        try {
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'automation_scripts.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('All scripts downloaded as automation_scripts.zip!');
        } catch (error) {
            console.error('Error generating ZIP:', error);
            alert('Failed to generate ZIP file. Please try again.');
        } finally {
            setIsProcessing(false); // Hide processing indicator
            setLoadingMessage(""); // Clear loading message
        }
    };


    /**
     * Handles sending a message to the agent.
     * Constructs a payload with the message, agent ID, API URL, API key, and any uploaded files,
     * then makes an actual API call to the Azure AI Foundry agent.
     */
    const handleSendMessage = async () => {
        // Check if there's actual content (text) or any files are uploaded
        if (!currentMessage.trim() && uploadedHtmlFiles.length === 0 && uploadedImageFiles.length === 0) {
            // Do not send if no meaningful message and no files are uploaded
            return;
        }

        let messagesToAdd = [];
        const userTextMessage = currentMessage.trim();

        if (userTextMessage) {
            messagesToAdd.push({ sender: 'user', type: 'text', content: userTextMessage, text: userTextMessage });
        }
        // Add uploaded file info to messages if present
        uploadedHtmlFiles.forEach(file => {
            messagesToAdd.push({ sender: 'user', type: 'html', content: file.content, text: `Uploaded HTML: ${file.name}` });
        });
        uploadedImageFiles.forEach(file => {
            messagesToAdd.push({ sender: 'user', type: 'image', content: file.content, text: `Uploaded Image: ${file.name}` });
        });

        // Add all new messages in one go
        setMessages((prevMessages) => [...prevMessages, ...messagesToAdd]);

        // Clear input fields and reset file states for the next input
        setCurrentMessage('');
        setUploadedHtmlFiles([]); // Clear array
        setUploadedImageFiles([]); // Clear array
        if (htmlInputRef.current) htmlInputRef.current.value = ''; // Clear actual input element
        if (imageInputRef.current) imageInputRef.current.value = ''; // Clear actual input element
        setSelectedTemplate(""); // Reset the template-select dropdown

        // Set initial processing state and message
        setIsProcessing(true);
        setLoadingMessage("Sending request...");

        // Introduce a small delay to ensure "Sending request..." is visible
        await new Promise(resolve => setTimeout(resolve, 300));

        // Get the dynamic system instructions based on current selection
        const dynamicSystemInstructions = getSystemInstructions(selectedTechnology);

        // Construct the messages array for the Azure OpenAI chat completion payload
        const chatMessages = [
            // System message for AI instructions
            { role: "system", content: dynamicSystemInstructions },
            // User's current query (now sending plain text)
            { role: "user", content: userTextMessage }, // Use userTextMessage here
        ];

        // Add uploaded HTML content to the messages if available
        uploadedHtmlFiles.forEach(file => {
            chatMessages.push({ role: "user", content: `Here is HTML content for analysis: ${file.content}` });
        });
        // Add uploaded image data to the messages if available (requires multi-modal model support)
        uploadedImageFiles.forEach(file => {
            // NOTE: For multi-modal models like gpt-4o, you would structure this differently, e.g.:
            // chatMessages.push({
            //     role: "user",
            //     content: [{ type: "image_url", image_url: { url: uploadedImage } }]
            // });
            // For now, sending as text description or you need to adjust 'content' type above
            chatMessages.push({ role: "user", content: `User has provided an image named ${file.name}. Please refer to it for visual context.` });
        });

        const payload = {
            messages: chatMessages,
            // Other parameters like temperature, max_tokens can be added here
            // temperature: 0.7,
            // max_tokens: 1000,
        };

        try {
            setLoadingMessage("Connecting to AI agent...");
            // Introduce a small delay to ensure "Connecting to AI agent..." is visible
            await new Promise(resolve => setTimeout(resolve, 300));

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // IMPORTANT: For Azure OpenAI Service, the API key is passed in the 'api-key' header.
                    'api-key': apiKey,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                // Attempt to parse error details from the response
                let errorDetails = `Status: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error && errorData.error.message) {
                        errorDetails = errorData.error.message;
                    } else if (errorData.message) {
                        errorDetails = errorData.message;
                    }
                } catch (parseError) {
                    // If JSON parsing fails, use the default status text
                    console.error("Failed to parse error response JSON:", parseError);
                }
                throw new Error(`Agent API Error: ${errorDetails}`);
            }

            setLoadingMessage("AI agent is generating script...");
            // Introduce a small delay to ensure "AI agent is generating script..." is visible
            await new Promise(resolve => setTimeout(resolve, 300));

            const result = await response.json();
            console.log('Agent response:', result);

            // Azure OpenAI chat completion responses usually have the generated content in:
            // result.choices[0].message.content
            const agentResponseText = result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content
                ? result.choices[0].message.content
                : 'No specific text output received from agent.';

            // --- Enhanced Error Handling for Irrelevant Input ---
            const parsedCodeBlocks = parseCodeBlocks(agentResponseText);
            // userMessageContent is already captured at the start of handleSendMessage
            const isIrrelevantInput = !containsRelevantKeywords(userTextMessage, automationKeywords); // Use userTextMessage here
            const aiGeneratedCode = parsedCodeBlocks.length > 0;

            if (aiGeneratedCode && isIrrelevantInput) {
                // If AI generated code, but user input was detected as irrelevant
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        sender: 'system',
                        type: 'text',
                        text: "It looks like the input was too vague or didn't contain enough details for me to generate a meaningful automation script. Please provide a more specific test case description or relevant HTML/image.",
                        isError: true, // Mark as error for styling
                    },
                ]);
            } else if (!aiGeneratedCode && userTextMessage.length > 0) {
                // If AI did NOT generate code blocks, but user sent a non-empty message
                // This means the AI might have responded conversationally (e.g., asking a clarifying question)
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        sender: 'agent', // Treat AI's conversational response as a regular agent message
                        type: 'text',
                        text: agentResponseText, // Display whatever the AI responded with
                    },
                ]);
            } else {
                // This is the expected successful code generation path
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        sender: 'agent',
                        type: 'codeBlocks', // New type to indicate structured code content
                        codeBlocks: parsedCodeBlocks,
                        text: agentResponseText // Keep original text for fallback/debugging if needed
                    },
                ]);
            }

        } catch (error) {
            console.error('Error connecting to agent:', error);
            let userFacingError = "An unexpected error occurred.";
            if (error.message.includes("Failed to fetch")) {
                userFacingError = "Network error: Could not connect to the AI agent. Please check your internet connection or the API URL.";
            } else if (error.message.includes("Agent API Error:")) {
                userFacingError = `AI Agent Error: ${error.message.replace("Agent API Error: ", "")}. Please verify your API Key and Agent ID, and ensure the API URL is correct.`;
            } else {
                userFacingError = `An unexpected error occurred: ${error.message}. Please try again.`;
            }

            setMessages((prevMessages) => [
                ...prevMessages,
                { sender: 'system', type: 'text', text: userFacingError, isError: true }, // Mark as error for styling
            ]);
        } finally {
            setIsProcessing(false); // Hide processing indicator
            setLoadingMessage(""); // Clear loading message
        }
    };

    /**
     * Handles file selection for both HTML and image files.
     * Reads the file content and updates the corresponding state.
     */
    const handleFileChange = (event, fileType) => {
        const files = Array.from(event.target.files); // Convert FileList to Array
        if (files.length === 0) return;

        // File size limits in bytes
        const HTML_MAX_SIZE = 2 * 1024 * 1024; // 2 MB
        const IMAGE_MAX_SIZE = 1 * 1024 * 1024; // 1 MB

        // Allowed MIME types
        const ALLOWED_HTML_TYPES = ['text/html'];
        const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

        files.forEach(file => {
            let isValid = true;
            let errorMessage = '';

            if (fileType === 'html') {
                if (uploadedHtmlFiles.length >= 2) {
                    isValid = false;
                    errorMessage = `Cannot upload more than 2 HTML files. Please remove an existing HTML file first.`;
                } else if (file.size > HTML_MAX_SIZE) {
                    isValid = false;
                    errorMessage = `HTML file "${file.name}" is too large. Maximum size is 2 MB.`;
                } else if (!ALLOWED_HTML_TYPES.includes(file.type)) {
                    isValid = false;
                    errorMessage = `Invalid HTML file type for "${file.name}". Only .html or .htm files are allowed.`;
                }
            } else if (fileType === 'image') {
                if (uploadedImageFiles.length >= 2) {
                    isValid = false;
                    errorMessage = `Cannot upload more than 2 image files. Please remove an existing image file first.`;
                } else if (file.size > IMAGE_MAX_SIZE) {
                    isValid = false;
                    errorMessage = `Image file "${file.name}" is too large. Maximum size is 1 MB.`;
                } else if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                    isValid = false;
                    errorMessage = `Invalid image file type for "${file.name}". Only PNG, JPEG, or JPG images are allowed.`;
                }
            }

            if (!isValid) {
                setMessages(prevMessages => [...prevMessages, { sender: 'system', type: 'text', text: errorMessage, isError: true }]);
                return; // Skip processing this file
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const newFile = { id: crypto.randomUUID(), name: file.name, content: e.target.result };
                if (fileType === 'html') {
                    setUploadedHtmlFiles(prevFiles => [...prevFiles, newFile]);
                    console.log('HTML file loaded:', file.name);
                } else if (fileType === 'image') {
                    setUploadedImageFiles(prevFiles => [...prevFiles, newFile]); // Base64 data URL
                    console.log('Image file loaded:', file.name);
                }
            };

            if (fileType === 'html') {
                reader.readAsText(file);
            } else if (fileType === 'image') {
                reader.readAsDataURL(file); // Reads file as a data URL (base64)
            }
        });
        // Clear the input value after processing all files to allow re-selection of the same files
        if (event.target) {
            event.target.value = '';
        }
    };

    /**
     * Removes an uploaded file from the state.
     * @param {string} fileType 'html' or 'image'
     * @param {string} id The unique ID of the file to remove.
     */
    const removeFile = (fileType, id) => {
        if (fileType === 'html') {
            setUploadedHtmlFiles(prevFiles => prevFiles.filter(file => file.id !== id));
        } else if (fileType === 'image') {
            setUploadedImageFiles(prevFiles => prevFiles.filter(file => file.id !== id));
        }
    };

    // Pre-defined test case templates
    const testCaseTemplates = [
        { name: "Select a template...", prompt: "" },
        { name: "Login Functionality", prompt: "Generate a test case for user login. The page has fields for 'username' and 'password', and a 'Login' button. Use the following HTML:\n\n<form id='loginForm'>\n  <input type='text' id='username' name='username'>\n  <input type='password' id='password' name='password'>\n  <button type='submit' id='loginButton'>Login</button>\n</form>" },
        { name: "User Registration", prompt: "Generate a test case for new user registration. The form includes fields for 'name', 'email', 'password', 'confirm password', and a 'Register' button. Include validation for password match." },
        { name: "Search Functionality", prompt: "Generate a test case for a search bar. The page has an input field with id 'searchBox' and a button with id 'searchButton'. Verify that results are displayed after search." },
        { name: "Add Item to Cart", prompt: "Generate a test case for adding an item to a shopping cart. Assume there's a product page with an 'Add to Cart' button and a quantity selector. Verify the item is added to the cart." },
        { name: "Form Submission", prompt: "Generate a test case for submitting a contact form. The form has 'name', 'email', and 'message' text areas, and a 'Send' button. Verify a success message is shown." },
        { name: "Broken Link Check", prompt: "Generate a test case to check for broken links on a given webpage. Iterate through all links and verify their status codes." },
        { name: "Dropdown Selection", prompt: "Generate a test case to select an option from a dropdown menu. The dropdown has an ID 'countryDropdown' and contains options like 'USA', 'Canada', 'UK'." },
        { name: "File Upload", prompt: "Generate a test case for uploading a file. The page has an input element of type 'file' with id 'fileUploadInput' and a 'Upload' button. Verify the file is uploaded successfully." },
        { name: "Table Data Extraction", prompt: "Generate a test case to extract data from an HTML table. The table has an ID 'dataTable' and contains columns like 'Name', 'Age', 'City'. Extract all rows." },
        { name: "Dynamic Content Load", prompt: "Generate a test case for a page that loads content dynamically after a button click. There's a button with ID 'loadMore' and a div with ID 'dynamicContent' that gets populated. Verify new content appears." },
        // New templates added below:
        { name: "Handle Pop-up/Alert", prompt: "Generate a test case to handle a JavaScript alert. The test should click a button that triggers an alert, accept the alert, and verify a success message." },
        { name: "Drag and Drop", prompt: "Generate a test case for a drag-and-drop interaction. There's a draggable element with ID 'draggableItem' and a droppable area with ID 'droppableArea'. Verify the item is successfully dropped." },
        { name: "Keyboard Actions", prompt: "Generate a test case to simulate keyboard actions. On an input field, enter text, then press the 'Enter' key, and verify the action performed." },
        { name: "Screenshot Capture", prompt: "Generate a test case that navigates to a URL, performs a simple action, and then captures a screenshot of the page." },
        { name: "Pagination Navigation", prompt: "Generate a test case to navigate through paginated results. The page has 'Next' and 'Previous' buttons and a display showing the current page number. Verify navigation and content change." },
    ];

    // State for the selected template in the dropdown
    const [selectedTemplate, setSelectedTemplate] = useState("");

    // Handle template selection
    const handleTemplateSelect = (event) => {
        const selectedPrompt = event.target.value;
        setSelectedTemplate(selectedPrompt); // Update the dropdown's selected value
        if (selectedPrompt) {
            setCurrentMessage(selectedPrompt); // Set the textarea content
        }
    };

    // Calculate total number of downloadable code blocks
    const totalDownloadableCodeBlocksCount = messages.reduce((count, msg) => {
        if (msg.type === 'codeBlocks' && msg.sender === 'agent' && msg.codeBlocks) {
            return count + msg.codeBlocks.length;
        }
        return count;
    }, 0);

    // Condition to show the "Download All as ZIP" button
    const showDownloadAllZipButton = totalDownloadableCodeBlocksCount > 1;

    // Ordered list of technologies for the dropdown
    const technologyOptions = [
        'Selenium with TestNG and Java',
        'Selenium with Cucumber and Java',
        'Selenium with Specflow and C#',
        'Selenium with Python',
        'Selenium with JUnit and Java',
        'Playwright with JavaScript',
        'Playwright with TypeScript',
        'Playwright with C#',
        'Cypress with JavaScript',
        'WebdriverIO with JavaScript',
        'WebdriverIO with TypeScript',
        'Robot Framework with Python',
        'Appium with Java',
        'Appium with Python',
        'Karate DSL'
    ];

    return (
        // Main container with full height and responsive design
        <div className="flex flex-col h-screen font-sans bg-gray-100 p-4 sm:p-6 lg:p-8">
            <style>
                {`
                @import url('[https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap](https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap)');
                body {
                    font-family: 'Inter', sans-serif;
                }
                /* Ensure pre/code blocks respect padding and overflow */
                pre {
                    margin: 0; /* Remove default pre margin */
                    padding: 1rem; /* Add padding to the code block */
                    border-radius: 0.375rem; /* rounded-md */
                    overflow-x: auto; /* Enable horizontal scrolling */
                    font-family: "Fira Code", "Consolas", "Monaco", "Andale Mono", "Ubuntu Mono", monospace;
                    font-size: 0.875rem; /* text-sm */
                    background-color: #1a202c; /* Tailwind gray-900 or a dark shade */
                    color: #e2e8f0; /* Tailwind gray-200 or a light shade for text */
                }
                /* SVG icon styling */
                .icon {
                    display: inline-block;
                    width: 1.2em; /* Slightly larger icons */
                    height: 1.2em;
                    stroke-width: 2; /* Make stroke visible */
                    stroke: currentColor;
                    fill: none; /* Ensure fill is none for outline icons */
                }
                /* Specific fill for checkmark icon */
                .icon-filled {
                    fill: currentColor;
                    stroke: none;
                }
                `}
            </style>
            

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 rounded-xl shadow-lg mb-6 flex justify-between items-center">
                <h1 className="text-2xl sm:text-2xl font-bold">Automation Starter Script Generator</h1>
                {/* Technology Selection Dropdown and Clear Chat Button */}
                <div className="relative flex items-center space-x-4">
                    <select
                        id="technology-select"
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 md:text-md text-white-800 bg-black"
                        value={selectedTechnology}
                        onChange={(e) => setSelectedTechnology(e.target.value)}
                        style={{ textAlign: 'left' }}
                    >
                        {technologyOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    {/* Clear Chat History Button */}
                    <button
                        onClick={confirmClearChat}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-semibold shadow-md transition duration-200 flex items-center justify-center"
                        title="Clear Chat History"
                    >
                        <svg className="icon w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Chat History Area */}
            <div className="flex-1 bg-white p-4 rounded-xl shadow-md overflow-y-auto mb-6 flex flex-col items-center">
                {messages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-gray-500 italic">
                        Start a conversation or upload a file to get started!
                    </div>
                )}
                {messages.map((msg, messageIndex) => (
                    <div
                        key={messageIndex}
                        className={`mb-3 p-3 rounded-lg shadow-sm w-full ${
                            msg.sender === 'user'
                                ? 'bg-blue-500 text-white self-end rounded-br-none max-w-[80%]'
                                : msg.sender === 'agent'
                                ? 'bg-gray-200 text-gray-800 self-start rounded-bl-none max-w-4xl lg:max-w-5xl'
                                : msg.sender === 'system' && msg.isError // Apply error styling
                                ? 'bg-red-100 text-red-800 self-center rounded-lg border border-red-300 max-w-[80%]'
                                : 'bg-red-100 text-red-800 self-center rounded-lg border border-red-300 max-w-[80%]' // Fallback, though system messages should be errors
                        }`}
                    >
                        {/* Render based on message type */}
                        {msg.type === 'codeBlocks' && msg.sender === 'agent' ? (
                            // Iterate over parsed code blocks
                            msg.codeBlocks.map((block, blockIndex) => {
                                const uniqueKey = `${messageIndex}-${blockIndex}`; // Unique key for each code block
                                return (
                                    <div key={uniqueKey} className="relative bg-gray-800 rounded-md p-0 mb-4 last:mb-0">
                                        {block.filename && (
                                            <div className="absolute -top-6 left-0 text-xs text-gray-400 px-2 py-1 rounded-t-md bg-gray-700">
                                                {block.filename}
                                            </div>
                                        )}
                                        <pre>
                                            <code>
                                                {block.content}
                                            </code>
                                        </pre>
                                        <div className="absolute top-2 right-2 flex space-x-2">
                                            <button
                                                onClick={() => copyToClipboard(block.content, uniqueKey)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-1 px-2 rounded-md transition-colors duration-200 flex items-center justify-center"
                                                title={copiedKey === uniqueKey ? 'Copied!' : 'Copy Code'}
                                            >
                                                {copiedKey === uniqueKey ? (
                                                    <svg className="icon w-4 h-4 icon-filled" viewBox="0 0 24 24">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                ) : (
                                                    <svg className="icon w-4 h-4" viewBox="0 0 24 24">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => downloadCodeAsFile(block.content, block.filename, messageIndex, blockIndex)}
                                                className={`bg-green-500 text-white text-xs font-semibold py-1 px-2 rounded-md transition-colors duration-200 flex items-center justify-center ${block.isDownloaded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}`}
                                                title={block.isDownloaded ? 'Downloaded' : 'Download File'}
                                                disabled={block.isDownloaded}
                                            >
                                                {block.isDownloaded ? (
                                                    <svg className="icon w-4 h-4 icon-filled" viewBox="0 0 24 24">
                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                    </svg>
                                                ) : (
                                                    <svg className="icon w-4 h-4" viewBox="0 0 24 24">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            // Render as regular paragraph for other message types
                            <p className="break-words">{msg.text}</p>
                        )}

                        {/* Display uploaded HTML content (truncated) with light green background */}
                        {msg.type === 'html' && msg.content && (
                            <div className="mt-2 text-xs opacity-80 overflow-auto max-h-24 bg-green-100 p-2 rounded-md">
                                <span className="font-semibold">HTML Content:</span> <pre className="whitespace-pre-wrap break-all text-sm">{msg.content.substring(0, 500)}{msg.content.length > 500 ? '...' : ''}</pre>
                            </div>
                        )}
                        {/* Display uploaded image with light purple background */}
                        {msg.type === 'image' && msg.content && (
                            <div className="mt-2 bg-purple-100 p-2 rounded-md">
                                <img src={msg.content} alt="Uploaded" className="max-w-full h-auto rounded-md" />
                            </div>
                        )}
                    </div>
                ))}
                {isProcessing && (
                    <div className="self-start mb-3 p-3 rounded-lg bg-gray-300 text-gray-700 animate-pulse max-w-[80%]">
                        {loadingMessage}
                    </div>
                )}
                <div ref={messagesEndRef} /> {/* Scroll target */}
                {/* Download All as ZIP Button - Moved inside chat area */}
                {showDownloadAllZipButton && (
                    <div className="w-full flex justify-end mt-4"> {/* Changed justify-center to justify-end */}
                        <button
                            onClick={handleDownloadAllAsZip}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
                            title="Download All Scripts as ZIP"
                            disabled={isProcessing}
                        >
                            <svg className="icon w-5 h-5 mr-2" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            ZIP
                        </button>
                    </div>
                )}
            </div>

            {/* Message Input and File Uploads */}
            <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row items-start gap-4">
                {/* Primary Textarea Input */}
                <textarea
                    className="flex-[3] p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 w-full resize-y sm:h-[108px]"
                    placeholder="Type your test case details or query..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    disabled={isProcessing}
                ></textarea>

                {/* Right-side controls container using grid */}
                <div className="grid grid-cols-2 grid-rows-2 gap-3 w-full sm:flex-[1] sm:h-[108px] sm:grid-cols-[2fr_1fr]">
                    {/* Template Dropdown - in first row, first column */}
                    <select
                        id="template-select"
                        className="block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-white bg-black col-start-1 row-start-1"
                        value={selectedTemplate}
                        onChange={handleTemplateSelect}
                        disabled={isProcessing}
                    >
                        {testCaseTemplates.map((template, index) => (
                            <option key={index} value={template.prompt}>
                                {template.name}
                            </option>
                        ))}
                    </select>

                    {/* File Upload Buttons - in second row, first column. Use flex for inner layout */}
                    {!isHiding && (
                    <div className="flex flex-row gap-3 col-start-1 row-start-2">
                        <label className="flex items-center justify-center bg-green-500 text-white px-4 py-3 rounded-lg font-semibold shadow-md hover:bg-green-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1">
                            <svg className="icon w-5 h-5 mr-2" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="12" y1="17" x2="12" y2="11"></line>
                                <polyline points="9 14 12 11 15 14"></polyline>
                            </svg>
                            HTML
                            <input
                                type="file"
                                accept="text/html" // Only HTML MIME type
                                onChange={(e) => handleFileChange(e, 'html')}
                                className="hidden"
                                disabled={isProcessing}
                                ref={htmlInputRef}
                                multiple // Allow multiple file selection
                            />
                        </label>
                        <label className="flex items-center justify-center bg-purple-500 text-white px-4 py-3 rounded-lg font-semibold shadow-md hover:bg-purple-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1">
                            <svg className="icon w-5 h-5 mr-2" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                            Image
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg" // Only specific image MIME types
                                onChange={(e) => handleFileChange(e, 'image')}
                                className="hidden"
                                disabled={isProcessing}
                                ref={imageInputRef}
                                multiple // Allow multiple file selection
                            />
                        </label>
                    </div>
                    )}
                    {/* Generate Button - spans 2 rows, in second column */}
                    <button
                        onClick={handleSendMessage}
                        className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed col-start-2 row-span-2 flex items-center justify-center"
                        disabled={isProcessing}
                    >
                        Generate
                    </button>
                </div>
            </div>

            {/* Displaying upload status */}
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-600">
                {uploadedHtmlFiles.map(file => (
                    <span key={file.id} className="bg-green-100 text-green-800 px-3 py-1 rounded-full flex items-center">
                        {file.name}
                        <button onClick={() => removeFile('html', file.id)} className="ml-2 text-green-500 hover:text-green-700 focus:outline-none">
                            <svg className="icon w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </span>
                ))}
                {uploadedImageFiles.map(file => (
                    <span key={file.id} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full flex items-center">
                        {file.name}
                        <button onClick={() => removeFile('image', file.id)} className="ml-2 text-purple-500 hover:text-purple-700 focus:outline-none">
                            <svg className="icon w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </span>
                ))}
            </div>

            {/* Download Confirmation Modal (post-download) */}
            {showDownloadConfirmationModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Download Complete!</h3>
                        <p className="text-gray-700 mb-6">
                            The file "<span className="font-bold">{downloadedFilename}</span>" has been downloaded. Please check your Downloads folder.
                        </p>
                        <button
                            onClick={closeDownloadConfirmationModal}
                            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
                        >
                            Got It!
                        </button>
                    </div>
                </div>
            )}

            {/* Clear Chat Confirmation Modal */}
            {showClearChatConfirmationModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Clear Chat History?</h3>
                        <p className="text-gray-700 mb-6">
                            Are you sure you want to clear the entire chat history? This action cannot be undone.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={cancelClearChat}
                                className="px-5 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeClearChat}
                                className="px-5 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-200"
                            >
                                Clear Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StarterScriptGeneratorApp;