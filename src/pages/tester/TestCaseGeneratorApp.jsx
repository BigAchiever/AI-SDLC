import React, { useState, useEffect, useCallback, useRef } from 'react'; // Import useRef
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore} from 'firebase/firestore';
import { X, RotateCcw } from 'lucide-react';
import { FaFileExcel } from 'react-icons/fa';


// Helper function to strip HTML tags from a string while preserving list item formatting
// This version uses DOMParser for more robust HTML stripping and aggressive whitespace/control character removal.
// It's used for general text content (like descriptions from ADO).
const stripHtmlTags = (htmlString) => {
    if (!htmlString) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    let cleanText = doc.body.textContent || ''; // Get plain text content of the body

    // Replace all ASCII control characters (0x00 to 0x1F and 0x7F to 0x9F) with a space
    cleanText = cleanText.replace(/[\x00-\x1F\x7F-\x9F]+/g, ' ');
    // Replace any sequence of whitespace characters (including newlines, tabs, spaces) with a single space
    cleanText = cleanText.replace(/\s+/g, ' ').trim();
    
    return cleanText;
};

// New helper function for stricter HTML/Control character stripping for content directly embedded into XML.
// This ensures content is as plain as possible, preventing ADO from misinterpreting it as malformed HTML.
// This version is modified to PRESERVE newlines (\n) for later <br/> conversion.
const stripForXmlContent = (str) => {
    if (typeof str !== 'string') return '';
    let cleaned = str.replace(/<[^>]*>/g, ''); // 1. Remove all HTML tags first

    // 2. Remove specific XML 1.0 invalid control characters (excluding \t, \n, \r)
    // This regex targets characters in ranges 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, and 0x7F-0x9F.
    // Also replace non-breaking spaces (\xA0) with empty string.
    // IMPORTANT: It explicitly avoids replacing \n, \r, \t.
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\xA0]/g, '');
    
    // DO NOT TRIM HERE. Let the newlines be preserved for the .replace(/\n/g, '<br/>') step.
    return cleaned;
};

// Helper function to XML escape strings for embedding in XML attributes/content
const xmlEscape = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        // .replace(/</g, '&lt;')
        // .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '\&apos;');
};


// Global App ID (provided by the Canvas environment)
// Safely access global variables by checking against 'window' object
const appId = typeof window !== 'undefined' && typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';

function TestCaseGeneratorApp() {
    // Firebase states
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // UI Mode states
    const [activeSection, setActiveSection] = useState('general'); // 'general', 'ado', 'jira'
    const [generatedForSection, setGeneratedForSection] = useState(null); // New state to track which section generated TCs
    const [showJiraButton, setShowJiraButton] = useState(false);
    
    // Azure DevOps connection states
    const [organization, setOrganization] = useState(''); // Pre-filled
    const [project, setProject] = useState(''); // Pre-filled
    const [pat, setPat] = useState(''); // Pre-filled
    const [userStoryIdInput, setUserStoryIdInput] = useState(''); // Changed from epicId to userStoryIdInput
    const [isConnected, setIsConnected] = useState(false);
    const [connectionMessage, setConnectionMessage] = useState('');

    // Data fetching states (for internal use by fetch logic, not directly for prompt)
    const [currentUserStoryDetails, setCurrentUserStoryDetails] = useState(null); 
    const [parentEpicDetails, setParentEpicDetails] = useState(null); 
    const [otherLinkedUserStories, setOtherLinkedUserStories] = useState([]); 
    const [fetchingStories, setFetchingStories] = useState(false);
    const [fetchError, setFetchError] = useState('');

    // Test case generation states
    const [generatedTestCases, setGeneratedTestCases] = useState([]);
    const [rawAgentResponseString, setRawAgentResponseString] = useState('');
    const [generatingTestCases, setGeneratingTestCases] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const [adoContent, setAdoContent] = useState('');
    const [correctionText, setCorrectionText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Modal state for custom alerts
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalType, setModalType] = useState('info'); // 'info', 'confirm'
    const [modalOnConfirm, setModalOnConfirm] = useState(null);
    const [modalConfirmButtonClass, setModalConfirmButtonClass] = useState('');

    // Push all to ADO button state
    const [pushingAllToAdo, setPushingAllToAdo] = useState(false);
    const [hasPushedAllSuccessfully, setHasPushedAllSuccessfully] = useState(false);
    
    // State for General section text areas (editable inputs)
    const [primaryRequirementsText, setPrimaryRequirementsText] = useState('');
    const [otherRequirementsText, setOtherRequirementsText] = useState('');

    // NEW: State for ADO section display (read-only divs, updated only by fetch)
    const [adoPrimaryRequirementsDisplay, setAdoPrimaryRequirementsDisplay] = useState('');
    const [adoOtherRequirementsDisplay, setAdoOtherRequirementsDisplay] = useState('');

    // Refs for hidden file inputs
    const documentInputRef = useRef(null);
    const imageInputRef = useRef(null);    

    // NEW: State for uploaded files list
    const [uploadedFiles, setUploadedFiles] = useState([]);

    // Custom Modal Component for confirmations/alerts
    const CustomModal = ({ message, type, onConfirm, onClose, confirmButtonClass }) => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-auto animate-fade-in-up">
                <p className="text-lg font-semibold text-gray-800 mb-4">{message}</p>
                <div className="flex justify-end space-x-3">
                    {type === 'confirm' && (
                        <button
                            onClick={onConfirm}
                            className={`px-4 py-2 text-white rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition duration-150 ease-in-out ${confirmButtonClass}`}
                        >
                            Confirm
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
                    >
                        {type === 'confirm' ? 'Cancel' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );

    const openModal = (message, type = 'info', onConfirm = null, confirmButtonClass = '') => {
        setModalMessage(message);
        setModalType(type);
        setModalOnConfirm(() => onConfirm);
        setModalConfirmButtonClass(confirmButtonClass);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setModalMessage('');
        setModalType('info');
        setModalOnConfirm(null);
    };

    // 1. Initialize Firebase and handle authentication
    useEffect(() => {
        const firebaseConfigString = typeof window !== 'undefined' ? window.__firebase_config : undefined;
        const initialAuthToken = typeof window !== 'undefined' ? window.__initial_auth_token : null;
        console.log("DEBUG: Firebase Config String:", firebaseConfigString);
        if (firebaseConfigString) {
            const firebaseConfig = JSON.parse(firebaseConfigString);

            if (firebaseConfig && firebaseConfig.projectId) {
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                    if (user) {
                        setUserId(user.uid);
                        setIsAuthReady(true);
                        console.log("Firebase Auth State Changed: User signed in:", user.uid);
                    } else {
                        console.log("Firebase Auth State Changed: No user detected. Attempting anonymous sign-in...");
                        signInAnonymously(firebaseAuth)
                            .then(() => {
                                console.log("Successfully signed in anonymously.");
                            })
                            .catch((anonError) => {
                                console.error("Error signing in anonymously:", anonError);
                                setIsAuthReady(true); // Still set auth ready even if anon sign in fails
                            });
                    }
                });

                if (initialAuthToken) {
                    signInWithCustomToken(firebaseAuth, initialAuthToken)
                        .then(() => console.log("Attempted sign-in with custom token (success or already signed in)."))
                        .catch((error) => {
                            console.error("Error during initial custom token sign-in attempt:", error);
                        });
                } else {
                    console.log("No initial custom token provided. Auth state will be handled by onAuthStateChanged.");
                }

                return () => unsubscribe();
            } else {
                console.error("Firebase config is invalid or missing projectId.", firebaseConfig);
                openModal('Firebase configuration is invalid. App cannot connect to the database.', 'info');
            }
        } else {
            console.error("Firebase config global variable '__firebase_config' not found.");
            //openModal('Firebase configuration not found. App cannot initialize.', 'info');
        }
    }, []); // Empty dependency array ensures this runs only once after mount.


    // Azure DevOps API Service Helper
    const AzureDevOpsApiService = useCallback(() => {
        if (!organization || !project || !pat) {
            console.error("Organization, Project, or PAT is missing.");
            return null;
        }

        const encodedPat = btoa(`:${pat}`);
        console.log("encodedPat:", encodedPat);

        const baseUrl = `https://dev.azure.com/${organization}/${project}/_apis`;

        // Function to make a generic API call
        const makeApiCall = async (url, method = 'GET', body = null, contentType = 'application/json') => {
            const headers = {
                'Authorization': `Basic ${encodedPat}`,
                'Content-Type': contentType
            };
            try {
                const options = { method, headers };
                if (body) {
                    options.body = JSON.stringify(body);
                }
                console.log("DEBUG: makeApiCall - Request URL:", url);
                console.log("DEBUG: makeApiCall - Request Method:", method);
                console.log("DEBUG: makeApiCall - Request Headers:", headers);
                console.log("DEBUG: makeApiCall - Request Body (stringified):", options.body);

                const response = await fetch(url, options);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Azure DevOps API Error:", errorText);
                    throw new Error(`Azure DevOps API Error: ${response.status} - ${response.statusText} - ${errorText}`);
                }
                const jsonResponse = await response.json();
                console.log("DEBUG: makeApiCall - Response Body:", jsonResponse); // Log the successful response
                return jsonResponse;
            } catch (error) {
                    console.error("API Call Error:", error);
                    throw error;
            }
        };

        return {
            getWorkItem: async (id) => {
                const url = `${baseUrl}/wit/workitems/${id}?$expand=fields&api-version=7.1`;
                return makeApiCall(url);
            },
            queryWorkItems: async (wiqlQuery) => {
                const url = `${baseUrl}/wit/wiql?api-version=7.1`;
                console.log("DEBUG: Executing WIQL Query:", wiqlQuery);
                return makeApiCall(url, 'POST', { query: wiqlQuery });
            },
            createTestCase: async (title, description, steps, linkedUserStoryId, areaPath, state, priority, tags, testData, preconditions, postconditions) => {
                console.log("DEBUG: createTestCase received steps array:", steps);
                const createUrl = `${baseUrl}/wit/workitems/$Test%20Case?api-version=7.1`;

                const testStepsXml = `
<steps id="0" last="${steps.length}">
${steps.map((step, idx) => {
    const stepId = idx + 1;
    const actionRaw = stripForXmlContent(step.action || '').replace(/\n/g, '<br/>');
    const expectedRaw = stripForXmlContent(step.expected || '').replace(/\n/g, '<br/>');

    const escapedAction = xmlEscape(actionRaw).trim() || '&nbsp;';
    const escapedExpected = xmlEscape(expectedRaw).trim() || '&nbsp;';

    return `<step id='${stepId}' type='ActionStep'>
  <parameterizedString isformatted='true'>${escapedAction}</parameterizedString>
  <parameterizedString isformatted='true'>${escapedExpected}</parameterizedString>
</step>`;
}).join('\n')}
</steps>`.trim();

                console.log("DEBUG TC XML: Final TestSteps XML String:\n", testStepsXml);

                let finalDescriptionContent = stripHtmlTags(description || '');
                if (preconditions) finalDescriptionContent += `<br/><br/><strong>Preconditions:</strong><br/>${stripHtmlTags(preconditions)}`;
                if (postconditions) finalDescriptionContent += `<br/><br/><strong>Postconditions:</strong><br/>${stripHtmlTags(postconditions)}`;                
                if (testData) finalDescriptionContent += `<br/><br/><strong>Test Data:</strong><br/>${stripHtmlTags(testData)}`;
                if (!finalDescriptionContent.trim()) finalDescriptionContent = "N/A";
                console.log("DEBUG: Final Description Content for ADO:", finalDescriptionContent);
                const finalAreaPath = project; 
                console.log("DEBUG: Using AreaPath:", finalAreaPath);
                let finalState = state;
                if (!finalState || finalState.toLowerCase() !== 'design') {
                    finalState = 'Design';
                }
                const patches = [
                    { op: "add", path: "/fields/System.Title", value: title },
                    { op: "add", path: "/fields/System.Description", value: finalDescriptionContent },
                    { op: "add", path: "/fields/System.AreaPath", value: finalAreaPath  },
                    { op: "add", path: "/fields/System.State", value: finalState },
                    { op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: priority || 2 },
                    { op: "add", path: "/fields/System.Tags", value: tags || '' }
                ];

                if (linkedUserStoryId) {
                    patches.push({
                        op: "add",
                        path: "/relations/-",
                        value: {
                            rel: "System.LinkTypes.Related",
                            url: `https://dev.azure.com/${organization}/_apis/wit/workitems/${linkedUserStoryId}`
                        }
                    });
                }
                console.log("DEBUG: createTestCase - Sending to ADO - Patches Array:", JSON.stringify(patches, null, 2));
                console.log("DEBUG: createTestCase - Final TestSteps XML:", testStepsXml);
                // Step 1: Create the test case
                const createdItem = await makeApiCall(createUrl, 'POST', patches, 'application/json-patch+json');
                const workItemId = createdItem.id;
                console.log(`DEBUG: Test Case created with Work Item ID: ${workItemId}`);
                if (!workItemId) throw new Error("Test Case creation failed: No ID returned.");

                // Step 2: Patch the test steps
                const updateUrl = `${baseUrl}/wit/workitems/${workItemId}?api-version=7.1`;
                const stepPatch = [
                    {
                        op: "replace",
                        path: "/fields/Microsoft.VSTS.TCM.Steps",
                        value: testStepsXml
                    }
                ];

                console.log(`DEBUG: Patching test steps to Work Item ID ${workItemId}`);
                await makeApiCall(updateUrl, 'PATCH', stepPatch, 'application/json-patch+json');

                return workItemId;
            },
            // New function to update the System.History (Discussion) field
            updateWorkItemHistory: async (workItemId, commentText) => {
                
                const url = `${baseUrl}/wit/workitems/${workItemId}?api-version=7.1`;
                const patches = [
                    {
                        "op": "add",
                        "path": "/fields/System.History",
                        "value": commentText // This commentText is now expected to be pre-formatted HTML
                    }
                ];
                console.log(`DEBUG: updateWorkItemHistory - Sending to ADO - Work Item ID: ${workItemId}, Comment: "${commentText}"`);
                return makeApiCall(url, 'PATCH', patches, 'application/json-patch+json');
            }
        };
    }, [organization, project, pat]);

    const handleConnect = () => {
        if (organization && project && pat) {
            setIsConnected(true);
            setConnectionMessage('Connected to Azure DevOps!');
            openModal('Successfully Connected to your ADO Account!', 'info');
        } else {
            setIsConnected(false);
            setConnectionMessage('Please fill in all connection details.');
            openModal('Please fill in all connection details to connect.', 'info');
        }
    };

    const handleFetchUserStories = async () => {
        if (!isConnected) {
            openModal('Please connect to Azure DevOps first.', 'info');
            return;
        }
        if (!userStoryIdInput) {
            openModal('Please enter a User Story Work Item ID.', 'info');
            return;
        }

        setFetchingStories(true);
        setFetchError('');
        setCurrentUserStoryDetails(null);
        setParentEpicDetails(null);
        setOtherLinkedUserStories([]);
        setAdoPrimaryRequirementsDisplay(''); // Clear previous ADO display text
        setAdoOtherRequirementsDisplay('');   // Clear previous ADO display text


        const api = AzureDevOpsApiService();
        if (!api) {
            setFetchError("API service not initialized. Check connection details.");
            setFetchingStories(false);
            return;
        }

        try {
            const userStory = await api.getWorkItem(userStoryIdInput);
            console.log("DEBUG: Fetched User Story object (Full):", userStory);

            if (userStory.relations === undefined) {
                console.log("DEBUG: User Story Relations (raw): IS UNDEFINED.");
            } else if (userStory.relations === null) {
                console.log("DEBUG: User Story Relations (raw): IS NULL.");
            } else if (Array.isArray(userStory.relations) && userStory.relations.length === 0) {
                console.log("DEBUG: User Story Relations (raw): Is an empty array.");
            } else {
                console.log("DEBUG: User Story Relations (raw):", userStory.relations);
            }


            if (userStory.fields["System.WorkItemType"] !== "User Story") {
                openModal(`Work Item ID ${userStoryIdInput} is not a User Story. It is a ${userStory.fields["System.WorkItemType"]}.`, 'info');
                setFetchingStories(false);
                return;
            }

            const currentUserStoryData = {
                id: userStory.id,
                title: userStory.fields["System.Title"],
                description: userStory.fields["System.Description"] || 'No Description',
                acceptanceCriteria: userStory.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || 'No Acceptance Criteria',
                comments: userStory.fields["System.History"] || 'No Comments'
            };
            setCurrentUserStoryDetails(currentUserStoryData);

            // Populate ADO Primary Requirements Display with HTML content
            let primaryHtmlContent = `<strong>User Story ID:</strong> ${currentUserStoryData.id}<br/>`;
            primaryHtmlContent += `<strong>Title:</strong> ${currentUserStoryData.title}<br/><br/>`;
            primaryHtmlContent += `<strong>Description:</strong><br/>${currentUserStoryData.description}<br/><br/>`;
            primaryHtmlContent += `<strong>Acceptance Criteria:</strong><br/>${currentUserStoryData.acceptanceCriteria}<br/><br/>`;
            primaryHtmlContent += `<strong>Comments:</strong><br/>${currentUserStoryData.comments}`;
            setAdoPrimaryRequirementsDisplay(primaryHtmlContent);

            let parentEpicId = null;
            if (userStory.relations && Array.isArray(userStory.relations) && userStory.relations.length > 0) {
                const parentRelation = userStory.relations.find(
                    rel => rel.rel === "System.LinkTypes.Hierarchy-Reverse" && rel.url && rel.url.includes("_apis/wit/workitems/")
                );
                console.log("DEBUG: Direct Relations Check - Found parent relation:", parentRelation);

                if (parentRelation) {
                    const parentUrlParts = parentRelation.url.split('/');
                    const potentialId = parentUrlParts[parentUrlParts.length - 1];
                    if (!isNaN(potentialId) && parseInt(potentialId).toString() === potentialId) {
                         const potentialParentWorkItem = await api.getWorkItem(potentialId);
                         console.log("DEBUG: Potential Parent Work Item from direct relations:", potentialParentWorkItem);
                         if (potentialParentWorkItem && potentialParentWorkItem.fields?.["System.WorkItemType"] === 'Epic') {
                            parentEpicId = potentialParentWorkItem.id;
                            console.log("DEBUG: Parent Epic ID found via direct relations and direct fetch:", parentEpicId);
                         } else {
                            console.warn("DEBUG: Potential parent from direct relations is not an Epic or could not be fetched:", potentialId);
                         }
                    }
                }
            } else {
                console.log("DEBUG: User story has no direct relations or relations array is empty. Falling back to WIQL query.");
            }

            if (!parentEpicId) {
                try {
                    let allLinkedRelations = [];

                    const wiqlQueryForSourceLinks = `SELECT
                        [Source].[System.Id],
                        [Target].[System.Id]
                    FROM
                        WorkItemLinks
                    WHERE
                        [Source].[System.Id] = ${userStoryIdInput}
                    MODE (MustContain)`;
                    console.log("DEBUG: WIQL Query (Source Links):", wiqlQueryForSourceLinks);
                    const sourceLinksResult = await api.queryWorkItems(wiqlQueryForSourceLinks);
                    if (sourceLinksResult && sourceLinksResult.workItemRelations) {
                        allLinkedRelations = allLinkedRelations.concat(sourceLinksResult.workItemRelations);
                    }
                    console.log("DEBUG: WIQL Result (Source Links):", sourceLinksResult);

                    const wiqlQueryForTargetLinks = `SELECT
                        [Source].[System.Id],
                        [Target].[System.Id]
                    FROM
                        WorkItemLinks
                    WHERE
                        [Target].[System.Id] = ${userStoryIdInput}
                    MODE (MustContain)`;
                    console.log("DEBUG: WIQL Query (Target Links):", wiqlQueryForTargetLinks);
                    const targetLinksResult = await api.queryWorkItems(wiqlQueryForTargetLinks);
                    if (targetLinksResult && targetLinksResult.workItemRelations) {
                        allLinkedRelations = allLinkedRelations.concat(targetLinksResult.workItemRelations);
                    }
                    console.log("DEBUG: WIQL Result (Target Links):", targetLinksResult);

                    if (allLinkedRelations.length > 0) {
                        const allLinkedWorkItemIds = new Set();
                        for (const rel of allLinkedRelations) {
                            console.log("DEBUG: Processing relation from WIQL:", rel);
                            console.log("DEBUG: Relation type (rel.rel):", rel.rel, "Source ID:", rel.source?.id, "Target ID:", rel.target?.id);

                            if (rel.source && rel.source.id && rel.source.id !== parseInt(userStoryIdInput)) {
                                allLinkedWorkItemIds.add(rel.source.id);
                            }
                            if (rel.target && rel.target.id && rel.target.id !== parseInt(userStoryIdInput)) {
                                allLinkedWorkItemIds.add(rel.target.id);
                            }

                            if (!parentEpicId && rel.rel === 'System.LinkTypes.Hierarchy-Reverse' && rel.source?.id === parseInt(userStoryIdInput)) {
                                 const potentialEpicId = rel.target.id;
                                 const potentialParentWorkItem = await api.getWorkItem(potentialEpicId);
                                 if (potentialParentWorkItem && potentialParentWorkItem.fields?.["System.WorkItemType"] === 'Epic') {
                                     parentEpicId = potentialEpicId;
                                     console.log("DEBUG: Parent Epic ID found via combined WIQL results (Hierarchy-Reverse) and direct fetch:", parentEpicId);
                                     break;
                                 }
                            }
                            else if (!parentEpicId && rel.rel === 'System.LinkTypes.Hierarchy-Forward' && rel.target?.id === parseInt(userStoryIdInput)) {
                                const potentialEpicId = rel.source.id;
                                const potentialParentWorkItem = await api.getWorkItem(potentialEpicId);
                                if (potentialParentWorkItem && potentialParentWorkItem.fields?.["System.WorkItemType"] === 'Epic') {
                                    parentEpicId = potentialEpicId;
                                    console.log("DEBUG: Parent Epic ID found via combined WIQL results (Hierarchy-Forward) and direct fetch:", parentEpicId);
                                    break;
                                }
                            }
                            console.log("DEBUG: Current parentEpicId inside WIQL loop:", parentEpicId);
                        }

                        console.log("DEBUG: Unique linked work item IDs found from combined queries:", Array.from(allLinkedWorkItemIds));

                        for (const linkedId of Array.from(allLinkedWorkItemIds)) {
                            try {
                                const linkedWorkItem = await api.getWorkItem(linkedId);
                                console.log(`DEBUG: Successfully fetched full details for linked Work Item ID ${linkedId} (Type: ${linkedWorkItem.fields?.["System.WorkItemType"]}):`, linkedWorkItem);

                                                if (linkedWorkItem && linkedWorkItem.fields) {
                            if (linkedWorkItem.fields["System.WorkItemType"] === "User Story") {
                                fetchedOtherStories.push({
                                    id: linkedWorkItem.id, 
                                    title: linkedWorkItem.fields["System.Title"] || 'No Title',
                                    description: linkedWorkItem.fields["System.Description"] || 'No Description',
                                    acceptanceCriteria: linkedWorkItem.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || 'No Acceptance Criteria'
                                });
                            } else {
                                console.log(`DEBUG: Linked Work Item ID ${linkedId} is not a User Story (${linkedWorkItem.fields["System.WorkItemType"]}), skipping.`);
                            }
                        } else {
                            console.warn(`DEBUG: Linked Work Item ID ${linkedId} found but missing 'fields' property after direct fetch.`, linkedWorkItem);
                        }
                    } catch (detailFetchError) {
                        console.error(`DEBUG: Error fetching full details for linked Work Item ID ${linkedId} during debug:`, detailFetchError);
                    }
                }
            } else {
                console.log("DEBUG: Combined WIQL queries returned no workItemRelations or empty.");
            }
                } catch (wiqlError) {
                    console.error("DEBUG: Error during SECONDARY WIQL query for all links:", wiqlError);
                }
            }
            
            console.log("DEBUG: Parent Epic ID after all relation processing:", parentEpicId);
            
            if (!parentEpicId) {
                openModal(`No parent Epic found for User Story ID ${userStoryIdInput}. Please ensure it is linked to an Epic with a 'Parent' link type.`, 'info');
                setFetchingStories(false);
                return;
            }

            const parentEpic = await api.getWorkItem(parentEpicId);
            
            if (!parentEpic) {
                const errorMessage = `Could not retrieve details for parent Epic ID ${parentEpicId}. The API returned no data for this ID.`;
                console.error("ERROR:", errorMessage, parentEpic);
                openModal(errorMessage, 'info');
                setFetchingStories(false);
                return;
            }
            if (!parentEpic.fields) {
                const errorMessage = `Parent Epic ID ${parentEpicId} found, but its 'fields' property is missing or empty. This might indicate insufficient permissions or an unusual work item structure.`;
                console.error("ERROR:", errorMessage, parentEpic);
                openModal(errorMessage, 'info');
                setFetchingStories(false);
                return;
            }

            const parentEpicData = {
                id: parentEpic.id,
                title: parentEpic.fields?.["System.Title"] || 'No Title',
                description: parentEpic.fields?.["System.Description"] || 'No Description'
            };
            setParentEpicDetails(parentEpicData);
            console.log("DEBUG: parentEpicDetails state updated:", parentEpic.id, parentEpic.fields?.["System.Title"]);


            console.log("DEBUG: Attempting to fetch other linked User Stories for Epic ID:", parentEpicId);
            const wiqlQueryForChildStoryIds = `SELECT
                [Target].[System.Id]
            FROM
                WorkItemLinks
            WHERE
                [Source].[System.Id] = ${parentEpicId}
                AND [Link Type] = 'System.LinkTypes.Hierarchy-Forward'
            MODE (MustContain)`;

            console.log("DEBUG: WIQL Query for Child Story IDs:", wiqlQueryForChildStoryIds);
            const childStoryIdsResult = await api.queryWorkItems(wiqlQueryForChildStoryIds);
            console.log("DEBUG: WIQL Result for Child Story IDs:", childStoryIdsResult);

            const childUserStoryIds = [];
            if (childStoryIdsResult && childStoryIdsResult.workItemRelations) {
                childStoryIdsResult.workItemRelations.forEach(rel => {
                    if (rel.target && rel.target.id) {
                        childUserStoryIds.push(rel.target.id);
                    }
                });
            }

            console.log("DEBUG: Extracted raw child User Story IDs (before filtering):", childUserStoryIds);

            const fetchedOtherStories = [];
            if (childUserStoryIds.length > 0) {
                const uniqueChildUserStoryIds = [...new Set(childUserStoryIds)].filter(
                    id => id.toString() !== userStoryIdInput.toString() && id.toString() !== parentEpicId.toString()
                );
                console.log("DEBUG: Unique child User Story IDs to fetch details for (excluding current and epic):", uniqueChildUserStoryIds);

                for (const linkedId of uniqueChildUserStoryIds) {
                    try {
                        const linkedWorkItem = await api.getWorkItem(linkedId);
                        console.log(`DEBUG: Successfully fetched full details for linked Work Item ID ${linkedId} (Type: ${linkedWorkItem.fields?.["System.WorkItemType"]}):`, linkedWorkItem);

                                                if (linkedWorkItem && linkedWorkItem.fields) {
                            if (linkedWorkItem.fields["System.WorkItemType"] === "User Story") {
                                fetchedOtherStories.push({
                                    id: linkedId, // Use linkedId directly as it's already filtered
                                    title: linkedWorkItem.fields["System.Title"] || 'No Title',
                                    description: linkedWorkItem.fields["System.Description"] || 'No Description',
                                    acceptanceCriteria: linkedWorkItem.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || 'No Acceptance Criteria'
                                });
                            } else {
                                console.log(`DEBUG: Linked Work Item ID ${linkedId} is not a User Story (${linkedWorkItem.fields["System.WorkItemType"]}), skipping.`);
                            }
                        } else {
                            console.warn(`DEBUG: Linked Work Item ID ${linkedId} found but missing 'fields' property after direct fetch.`, linkedWorkItem);
                        }
                    } catch (detailFetchError) {
                        console.error(`DEBUG: Error fetching full details for linked Work Item ID ${linkedId} during debug:`, detailFetchError);
                    }
                }
            } else {
                console.log("DEBUG: No child User Story IDs found for this Epic after initial query.");
            }
            setOtherLinkedUserStories(fetchedOtherStories);

            // Populate ADO Other Requirements Display with HTML content from Epic and other stories
            let otherHtmlContent = '';
            if (parentEpicData) {
                otherHtmlContent += `<strong>Parent Epic ID:</strong> ${parentEpicData.id}<br/>`;
                otherHtmlContent += `<strong>Title:</strong> ${parentEpicData.title}<br/><br/>`;
                otherHtmlContent += `<strong>Description:</strong><br/>${parentEpicData.description}<br/><br/>`;
            }
            if (fetchedOtherStories.length > 0) {
                otherHtmlContent += `<strong>Other Linked User Stories:</strong><br/>`;
                fetchedOtherStories.forEach((story, idx) => {
                    otherHtmlContent += `<br/><strong>Story ${idx + 1} ID:</strong> ${story.id}<br/>`;
                    otherHtmlContent += `<strong>Title:</strong> ${story.title}<br/>`;
                    otherHtmlContent += `<strong>Description:</strong><br/>${story.description}<br/>`;
                    if (story.acceptanceCriteria) {
                        otherHtmlContent += `<strong>Acceptance Criteria:</strong><br/>${story.acceptanceCriteria}<br/>`;
                    }
                });
            }
            setAdoOtherRequirementsDisplay(otherHtmlContent);

            setFetchingStories(false);
            openModal('Requirements fetched successfully!', 'info');
        }
        catch (error) {
            console.error("Error fetching work item details:", error);
            setFetchError('Failed to fetch details: ' + error.message);
            openModal('Failed to fetch details: ' + error.message, 'info');
            setFetchingStories(false);
            setAdoPrimaryRequirementsDisplay(''); // Clear display on error
            setAdoOtherRequirementsDisplay('');   // Clear display on error
        }
    };

    // Helper function to parse Test Steps string into an array of {action, expected} objects
    const parseTestSteps = (stepsString) => {
        if (!stepsString) return [];
        const parsedSteps = [];

        // Normalize newlines and replace multiple newlines with single ones. DO NOT trim the whole string yet.
        const normalizedString = stepsString.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n');
        // Split by step number (e.g., "1. ", "2. "), keeping the number with the step for initial split.
        const rawSteps = normalizedString.split(/(?=\d+\.\s*)/).filter(s => s.trim() !== ''); // Still trim filter for empty entries

        console.log("DEBUG: parseTestSteps - Input stepsString:", stepsString);
        console.log("DEBUG: parseTestCases - Normalized string:", normalizedString);
        console.log("DEBUG: parseTestCases - Raw steps identified by regex split:", rawSteps);

        rawSteps.forEach(stepText => {
            // Remove the leading step number and period (e.g., "1. "). DO NOT trim here.
            const contentWithoutNumber = stepText.replace(/^\d+\.\s*/, '');

            let action = contentWithoutNumber;
            let expected = ''; 

            const delimiter = ":::EXPECTED_RESULT:::";
            const delimiterIndex = contentWithoutNumber.indexOf(delimiter);

            if (delimiterIndex !== -1) {
                action = contentWithoutNumber.substring(0, delimiterIndex); // DO NOT trim here
                expected = contentWithoutNumber.substring(delimiterIndex + delimiter.length); // DO NOT trim here
            } else {
                const expectedResultRegex = /(.*)(?:;?\s*(?:Expected(?: Result)?|ER|Exp\.?)\s*:?\s*)(.*)/i;
                const match = contentWithoutNumber.match(expectedResultRegex);

                if (match && match.length >= 3) {
                    action = match[1]; // DO NOT trim here
                    expected = match[2]; // DO NOT trim here
                } else {
                    action = contentWithoutNumber;
                    expected = '';
                }
            }

            // Collapse multiple newlines within action/expected, but do not trim them here.
            action = action.replace(/\n{2,}/g, '\n'); 
            expected = expected.replace(/\n{2,}/g, '\n'); 

            console.log(`DEBUG: parseTestSteps - Parsed Step - Action: "${action}", Expected: "${expected}"`);
            parsedSteps.push({ action: action, expected: expected }); // DO NOT TRIM HERE. Let stripForXmlContent handle final cleaning.
        });

        console.log("DEBUG: parseTestSteps - Final parsed steps array:", parsedSteps);
        return parsedSteps;
    };


    // Call Azure AI Foundry Agent to generate test cases
    const handleGenerateTestCases = async () => {
        let currentPromptContent = "";
        let sourcePrimaryText = "";
        let sourceOtherText = "";

        if (activeSection === 'general') {
            sourcePrimaryText = primaryRequirementsText;
            sourceOtherText = otherRequirementsText;
            if (!primaryRequirementsText.trim()) { // Check for general section's primary input
                openModal('Please enter content for "Primary Requirement Details" in the General section.', 'info');
                return;
            }
        } else if (activeSection === 'ado') {
            // In ADO mode, we use the content from currentUserStoryDetails, parentEpicDetails, etc.
            // These are already stripped of HTML tags when fetched.
            if (!currentUserStoryDetails || !parentEpicDetails) { // Check for ADO fetched data
                 openModal('Please fetch user story and epic details first in the ADO section.', 'info');
                 return;
            }
            sourcePrimaryText = `CURRENT USER STORY DETAILS:\nID: ${currentUserStoryDetails.id}\nTitle: ${currentUserStoryDetails.title}\nDescription: ${currentUserStoryDetails.description}\nAcceptance Criteria: ${currentUserStoryDetails.acceptanceCriteria}\nComments: ${currentUserStoryDetails.comments}\n\n`;
            if (parentEpicDetails) {
                sourceOtherText += `EPIC DETAILS:\nID: ${parentEpicDetails.id}\nTitle: ${parentEpicDetails.title}\nDescription: ${parentEpicDetails.description}\n\n`;
            }
            if (otherLinkedUserStories.length > 0) {
                sourceOtherText += "OTHER LINKED USER STORIES FOR REFERENCE ONLY (for context):\n";
                otherLinkedUserStories.forEach((story, index) => {
                    sourceOtherText += `User Story ${index + 1} ID: ${story.id}\nTitle: ${story.title}\nDescription: ${story.description}\nAcceptance Criteria: ${story.acceptanceCriteria}\n\n`;
                });
            }
        } else {
            openModal('Please select a valid section (ADO or General) to generate test cases.', 'info');
            return;
        }
        
        // For prompt generation, we always clean the input text to ensure AI gets plain text
        // Note: if `activeSection === 'ado'`, `sourcePrimaryText` and `sourceOtherText` are already clean strings constructed above.
        const cleanedPrimaryText = activeSection === 'general' ? stripHtmlTags(sourcePrimaryText) : sourcePrimaryText;
        const cleanedOtherText = activeSection === 'general' ? stripHtmlTags(sourceOtherText) : sourceOtherText;


        setGeneratingTestCases(true);
        setGenerationError('');
        setGeneratedTestCases([]);
        setRawAgentResponseString('');
        setHasPushedAllSuccessfully(false);
        setGeneratedForSection(activeSection); // Set the section for which TCs are being generated


        try {
            const agentEndpoint = import.meta.env.VITE_AGENT_ENDPOINT;            
            const apiKey = import.meta.env.VITE_API_KEY;
            
            currentPromptContent += "PRIMARY REQUIREMENT DETAILS:\n";
            currentPromptContent += cleanedPrimaryText + "\n\n";

            if (cleanedOtherText.trim()) {
                currentPromptContent += "OTHER RELATED DETAILS / CONTEXT:\n";
                currentPromptContent += cleanedOtherText + "\n\n";
            }

            // MODIFIED PROMPT: Explicitly ask AI to include "Generated by AI" in Comments
            currentPromptContent += `Please generate a JSON array of test cases based on these details. Each test case should have the following fields: ID (string) (example: X-001, X-002), Title (string), TestSteps (single string with steps like '1. Step Action:::EXPECTED_RESULT:::Expected Result Text 2. Another Step:::EXPECTED_RESULT:::Another Expected Result Text' - ensure this is PLAIN TEXT with no HTML tags, ready for XML embedding), TestData (string), State (e.g., 'Design'), Priority (1-4), AreaPath (string, e.g., '${project}\\Features\\UserStorySpecificArea' or '${project}\\DefaultArea'), AutomationStatus (string), Tags (e.g., 'UI; Functional'), Description (string), Preconditions (string), Postconditions (string), Comments (string). Ensure 'TestSteps' is a single string that I can can parse into an array later. Focus on functional and edge cases for the PRIMARY REQUIREMENT, and return the response in **JSON format**."`;
            
            //console.log("DEBUG: Final promptContent sent to AI Agent:", currentPromptContent);

            const requestBody = {
                messages: [
                    { "role": "user", "content": currentPromptContent }
                ],
                max_tokens: 10000,
                temperature: 0.7,
                response_format: { "type": "json_object" }
            };

            const agentResponse = await fetch(agentEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!agentResponse.ok) {
                const errorData = await agentResponse.text();
                throw new Error(`Agent API Error: ${agentResponse.status} - ${agentResponse.statusText} - ${errorData}`);
            }

            const result = await agentResponse.json();
            
            const messageContent = result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content
                ? result.choices[0].message.content
                : JSON.stringify(result, null, 2);
            setRawAgentResponseString(messageContent);

            let generated = [];
            if (result && result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
                try {
                    let parsedTestCases = JSON.parse(result.choices[0].message.content);
                    if (parsedTestCases && typeof parsedTestCases === 'object' && Array.isArray(parsedTestCases.testCases)) {
                        parsedTestCases = parsedTestCases.testCases;
                    }
                    
                    if (Array.isArray(parsedTestCases)) {
                        generated = parsedTestCases.map(tc => {
                            let combinedDescription = tc.Description || 'N/A';
                            let aiCommentsForHistory = tc.Comments || 'N/A'; // Store AI's raw comments for history

                            // Append AI's comments to description if they exist and are not just "N/A"
                            if (aiCommentsForHistory && aiCommentsForHistory.trim() !== 'N/A') {
                                combinedDescription += '\n\nAI Insights/Comments:\n' + stripHtmlTags(aiCommentsForHistory);
                            }

                            return {
                                ...tc,
                                Description: combinedDescription, // This will be sent to System.Description
                                steps: parseTestSteps(tc.TestSteps || ''),
                                aiCommentsForHistory: aiCommentsForHistory, // Original AI comments for System.History
                                Comments: "Test Case Generated by AI", // This is what shows in the UI table
                                isInactive: false
                            };
                        });
                    } else {
                        throw new Error("Parsed JSON is not an array of test cases.");
                    }
                } catch (jsonParseError) {
                    throw new Error(`Failed to parse AI agent's JSON response: ${jsonParseError.message}. Raw content: ${result.choices[0].message.content}`);
                }
            } else {
                throw new Error("Agent response structure is unexpected or content is missing.");
            }
            setGeneratedTestCases(generated);
            
            openModal('Test cases generated successfully!', 'info');

        } catch (error) {
            console.error("Error generating test cases:", error);
            setGenerationError('Failed to generate test cases: ' + error.message);
            openModal(`Failed to generate test cases: ${error.message}`, 'info');
        } finally {
             setGeneratingTestCases(false);
        }
    };

    const handleRegenerateTestCases = async () => {
        if (!currentUserStoryDetails) return alert("Please fetch a user story first.");
        if (!correctionText.trim()) return alert("Please enter a correction note.");

        const prompt = `
            The user story is:
            """${currentUserStoryDetails}"""

            Existing test cases had issues. Here is the correction feedback:
            """${correctionText}"""

            Please regenerate improved test cases in JSON array format.
        `;

        // try {
        //     setIsLoading(true);
        //     const correctedResponse = await callOpenAI(prompt);
        //     const parsed = JSON.parse(correctedResponse);
        //     if (!Array.isArray(parsed)) throw new Error('Expected an array');

        //     setGeneratedTestCases(parsed);
        //     alert('✅ Test cases regenerated successfully');
        //     setCorrectionText('');
        // } catch (err) {
        //     console.error('Error regenerating:', err);
        //     alert('❌ Failed to regenerate. Check the input format.');
        // } finally {
        //     setIsLoading(false);
        // }

        let currentPromptContent = "";
        let sourcePrimaryText = "";
        let sourceOtherText = "";

        if (activeSection === 'general') {
            sourcePrimaryText = primaryRequirementsText;
            sourceOtherText = otherRequirementsText;
            if (!primaryRequirementsText.trim()) { // Check for general section's primary input
                openModal('Please enter content for "Primary Requirement Details" in the General section.', 'info');
                return;
            }
        } else if (activeSection === 'ado') {
            // In ADO mode, we use the content from currentUserStoryDetails, parentEpicDetails, etc.
            // These are already stripped of HTML tags when fetched.
            if (!currentUserStoryDetails || !parentEpicDetails) { // Check for ADO fetched data
                 openModal('Please fetch user story and epic details first in the ADO section.', 'info');
                 return;
            }
            sourcePrimaryText = `CURRENT USER STORY DETAILS:\nID: ${currentUserStoryDetails.id}\nTitle: ${currentUserStoryDetails.title}\nDescription: ${currentUserStoryDetails.description}\nAcceptance Criteria: ${currentUserStoryDetails.acceptanceCriteria}\nComments: ${currentUserStoryDetails.comments}\n\n`;
            if (parentEpicDetails) {
                sourceOtherText += `EPIC DETAILS:\nID: ${parentEpicDetails.id}\nTitle: ${parentEpicDetails.title}\nDescription: ${parentEpicDetails.description}\n\n`;
            }
            if (otherLinkedUserStories.length > 0) {
                sourceOtherText += "OTHER LINKED USER STORIES FOR REFERENCE ONLY (for context):\n";
                otherLinkedUserStories.forEach((story, index) => {
                    sourceOtherText += `User Story ${index + 1} ID: ${story.id}\nTitle: ${story.title}\nDescription: ${story.description}\nAcceptance Criteria: ${story.acceptanceCriteria}\n\n`;
                });
            }
            if (correctionText.length > 0) {
                sourceOtherText += "Replace use the additional details like "+correctionText;
            }
        } else {
            openModal('Please select a valid section (ADO or General) to generate test cases.', 'info');
            return;
        }
        
        // For prompt generation, we always clean the input text to ensure AI gets plain text
        // Note: if `activeSection === 'ado'`, `sourcePrimaryText` and `sourceOtherText` are already clean strings constructed above.
        const cleanedPrimaryText = activeSection === 'general' ? stripHtmlTags(sourcePrimaryText) : sourcePrimaryText;
        const cleanedOtherText = activeSection === 'general' ? stripHtmlTags(sourceOtherText) : sourceOtherText;


        setGeneratingTestCases(true);
        setGenerationError('');
        setGeneratedTestCases([]);
        setRawAgentResponseString('');
        setHasPushedAllSuccessfully(false);
        setGeneratedForSection(activeSection); // Set the section for which TCs are being generated


        try {
            const agentEndpoint = import.meta.env.VITE_AGENT_ENDPOINT;            
            const apiKey = import.meta.env.VITE_API_KEY;
            
            currentPromptContent += "PRIMARY REQUIREMENT DETAILS:\n";
            currentPromptContent += cleanedPrimaryText + "\n\n";

            if (cleanedOtherText.trim()) {
                currentPromptContent += "OTHER RELATED DETAILS / CONTEXT:\n";
                currentPromptContent += cleanedOtherText + "\n\n";
            }

            // MODIFIED PROMPT: Explicitly ask AI to include "Generated by AI" in Comments
            currentPromptContent += `Please generate a JSON array of test cases based on these details. Each test case should have the following fields: ID (string) (example: X-001, X-002), Title (string), TestSteps (single string with steps like '1. Step Action:::EXPECTED_RESULT:::Expected Result Text 2. Another Step:::EXPECTED_RESULT:::Another Expected Result Text' - ensure this is PLAIN TEXT with no HTML tags, ready for XML embedding), TestData (string), State (e.g., 'Design'), Priority (1-4), AreaPath (string, e.g., '${project}\\Features\\UserStorySpecificArea' or '${project}\\DefaultArea'), AutomationStatus (string), Tags (e.g., 'UI; Functional'), Description (string), Preconditions (string), Postconditions (string), Comments (string). Ensure 'TestSteps' is a single string that I can can parse into an array later. Focus on functional and edge cases for the PRIMARY REQUIREMENT, and return the response in **JSON format**."`;
            
            //console.log("DEBUG: Final promptContent sent to AI Agent:", currentPromptContent);

            const requestBody = {
                messages: [
                    { "role": "user", "content": currentPromptContent }
                ],
                max_tokens: 10000,
                temperature: 0.7,
                response_format: { "type": "json_object" }
            };

            const agentResponse = await fetch(agentEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!agentResponse.ok) {
                const errorData = await agentResponse.text();
                throw new Error(`Agent API Error: ${agentResponse.status} - ${agentResponse.statusText} - ${errorData}`);
            }

            const result = await agentResponse.json();
            
            const messageContent = result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content
                ? result.choices[0].message.content
                : JSON.stringify(result, null, 2);
            setRawAgentResponseString(messageContent);

            let generated = [];
            if (result && result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
                try {
                    let parsedTestCases = JSON.parse(result.choices[0].message.content);
                    if (parsedTestCases && typeof parsedTestCases === 'object' && Array.isArray(parsedTestCases.testCases)) {
                        parsedTestCases = parsedTestCases.testCases;
                    }
                    
                    if (Array.isArray(parsedTestCases)) {
                        generated = parsedTestCases.map(tc => {
                            let combinedDescription = tc.Description || 'N/A';
                            let aiCommentsForHistory = tc.Comments || 'N/A'; // Store AI's raw comments for history

                            // Append AI's comments to description if they exist and are not just "N/A"
                            if (aiCommentsForHistory && aiCommentsForHistory.trim() !== 'N/A') {
                                combinedDescription += '\n\nAI Insights/Comments:\n' + stripHtmlTags(aiCommentsForHistory);
                            }

                            return {
                                ...tc,
                                Description: combinedDescription, // This will be sent to System.Description
                                steps: parseTestSteps(tc.TestSteps || ''),
                                aiCommentsForHistory: aiCommentsForHistory, // Original AI comments for System.History
                                Comments: "Test Case Generated by AI", // This is what shows in the UI table
                                isInactive: false
                            };
                        });
                    } else {
                        throw new Error("Parsed JSON is not an array of test cases.");
                    }
                } catch (jsonParseError) {
                    throw new Error(`Failed to parse AI agent's JSON response: ${jsonParseError.message}. Raw content: ${result.choices[0].message.content}`);
                }
            } else {
                throw new Error("Agent response structure is unexpected or content is missing.");
            }
            setGeneratedTestCases(generated);
            
            openModal('Test cases generated successfully!', 'info');

        } catch (error) {
            console.error("Error generating test cases:", error);
            setGenerationError('Failed to generate test cases: ' + error.message);
            openModal(`Failed to generate test cases: ${error.message}`, 'info');
        } finally {
             setGeneratingTestCases(false);
        }
    };

    const handleMarkTestCaseAsInactive = (indexToMarkInactive) => {
        openModal(
            'Are you sure you want to mark this test case as inactive? It will not be pushed to ADO.',
            'confirm',
            () => {
                setGeneratedTestCases(prevCases => prevCases.map((tc, index) =>
                    index === indexToMarkInactive ? { ...tc, isInactive: true } : tc
                ));
                closeModal();
            },
            'bg-red-600 hover:bg-red-700 focus:ring-red-500'
        );
    };

    const handleUndoMarkTestCaseAsInactive = (indexToUndo) => {
        setGeneratedTestCases(prevCases => prevCases.map((tc, index) =>
            index === indexToUndo ? { ...tc, isInactive: false } : tc
        ));
    };

    const handlePushAllToAzure = async () => {
        if (!isConnected) {
            openModal('Please connect to Azure DevOps first.', 'info');
            return;
        }
        
        const activeTestCasesToPush = generatedTestCases.filter(tc => !tc.isInactive);

        if (activeTestCasesToPush.length === 0) {
            openModal('No active test cases to push to Azure DevOps.', 'info');
            return;
        }

        openModal(
            `Are you sure you want to push ${activeTestCasesToPush.length} active test cases to Azure DevOps? This action cannot be undone.`,
            'confirm',
            async () => {
                setPushingAllToAdo(true);
                const api = AzureDevOpsApiService();
                if (!api) {
                    openModal("API service not initialized. Check connection details.", 'info');
                    setPushingAllToAdo(false);
                    return;
                }

                let successfulPushes = 0;
                let failedPushes = [];

                for (const tc of activeTestCasesToPush) {
                    try {
                        // Step 1: Create the Test Case with the combined description
                        const newTestCase = await api.createTestCase(
                            tc.Title,
                            tc.Description, // This now includes AI insights/comments
                            tc.steps,
                            currentUserStoryDetails.id,
                            tc.AreaPath,
                            tc.State,
                            tc.Priority,
                            tc.Tags,
                            tc.TestData,
                            tc.Preconditions,
                            tc.Postconditions
                        );

                        // Step 2: Add comments to System.History (Discussion) if available
                        if (newTestCase && newTestCase.id) {
                            let historyComment = `Test Case Generated by AI`;
                            // Prepend AI's original comments if they exist and are not just "N/A"
                            if (tc.aiCommentsForHistory && tc.aiCommentsForHistory.trim() !== 'N/A') {
                                // Format comments with <p> and <br/> tags for ADO History
                                historyComment = `<p>${tc.aiCommentsForHistory.replace(/\n/g, '<br/>')}</p><p>${historyComment}</p>`;
                            } else {
                                historyComment = `<p>${historyComment}</p>`; // Wrap even default in <p>
                            }
                            await api.updateWorkItemHistory(newTestCase.id, historyComment);
                        }

                        successfulPushes++;
                    } catch (error) {
                        const errorMessage = error.message || 'Unknown error';
                        failedPushes.push({ title: tc.Title, error: errorMessage });
                        console.error(`Failed to push test case "${tc.Title}" (ID: ${tc.ID}) to Azure DevOps:`, error);
                    }
                }

                let pushSummaryMessage = `Finished pushing test cases.\nSuccessful: ${successfulPushes} out of ${activeTestCasesToPush.length}.`;
                if (failedPushes.length > 0) {
                    pushSummaryMessage += `\n\nFailed to push:\n`;
                    failedPushes.forEach(item => {
                        pushSummaryMessage += `- ${item.title}: ${item.error}\n`;
                    });
                } else {
                    pushSummaryMessage += `\nAll generated active test cases pushed to Azure DevOps successfully!`;
                    setHasPushedAllSuccessfully(true);
                }
                openModal(pushSummaryMessage, 'info');
                setPushingAllToAdo(false);
            },
            'bg-green-600 hover:bg-green-700 focus:ring-green-500'
        );
    };

    // Helper function to escape CSV cell content
    const escapeCsvCell = (cell) => {
        if (cell === null || cell === undefined) return '';
        let value = String(cell);
        // If the value contains a comma, double quote, or newline, wrap it in double quotes
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            // Escape existing double quotes by doubling them
            value = value.replace(/"/g, '""');
            return `"${value}"`;
        }
        return value;
    };

    // New handler to export test cases to Excel (CSV format)
    const handleExportToExcel = () => {
        // Filter only active test cases for export
        const activeTestCasesForExport = generatedTestCases.filter(tc => !tc.isInactive);

        if (activeTestCasesForExport.length === 0) {
            openModal("No active test cases to export.", "info");
            return;
        }

        const headers = [
            "ID", "Title", "Description", "Preconditions", "Postconditions",
            "Test Data", "Test Steps", "State", "Priority", "Automation Status", "Tags", "Comments"
        ];

        // Format Test Steps for CSV
        const formatTestStepsForCsv = (steps) => {
            if (!Array.isArray(steps) || steps.length === 0) return '';
            return steps.map((step, idx) => {
                const action = step.action || '';
                const expected = step.expected || '';
                return `${idx + 1}. Action: ${action}\n   Expected Result: ${expected}`;
            }).join('\n\n');
        };

        const rows = activeTestCasesForExport.map(tc => [
            escapeCsvCell(tc.ID),
            escapeCsvCell(tc.Title),
            escapeCsvCell(tc.Description),
            escapeCsvCell(tc.Preconditions),
            escapeCsvCell(tc.Postconditions),
            escapeCsvCell(tc.TestData),
            escapeCsvCell(formatTestStepsForCsv(tc.steps)), // Format steps for CSV
            escapeCsvCell(tc.State),
            escapeCsvCell(tc.Priority),
            escapeCsvCell(tc.AutomationStatus || 'Manual'),
            escapeCsvCell(tc.Tags),
            escapeCsvCell(tc.Comments)
        ]);

        const csvContent = [
            headers.map(h => escapeCsvCell(h)).join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // Feature detection for download attribute
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'GeneratedTestCases.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            openModal("Active test cases exported to 'GeneratedTestCases.csv'.", "info");
        } else {
            openModal("Your browser does not support downloading files directly. Please try saving the page as CSV manually.", "info");
        }
    };


    // New handler for programmatically triggering file input click
    const triggerFileInput = (inputRef) => {
        inputRef.current.click();
    };

    // New handler for document file selection
    const handleDocumentFileChange = async (event) => {
        let currentPromptContent = "";
        let sourcePrimaryText = "";
        let sourceOtherText = "";
        const file = event.target.files[0];
        if (file) {
            const newFile = {
                id: Date.now() + Math.random(), // Unique ID
                name: file.name,
                type: 'document'
            };
            setUploadedFiles(prevFiles => [...prevFiles, newFile]);
            const reader = new FileReader();
            console.log("DEBUG: handleDocumentFileChange - Reading file:", file.name);
            reader.onload = (event) => {
                const content = event.target.result;
                const cleanContent = content.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Removes non-printable

                // You can now use `content` as plain text, e.g., set it in a textarea
                console.log("Selected document file content:", cleanContent);
                setAdoContent(cleanContent); // ⬅️ if you want to prefill user story input
                
                sourcePrimaryText = cleanContent;
                sourceOtherText = otherRequirementsText;
                if (!primaryRequirementsText.trim()) { // Check for general section's primary input
                    openModal('Please enter content for "Primary Requirement Details" in the General section.', 'info');
                    return;
                }
            };
            const cleanedPrimaryText = activeSection === 'general' ? stripHtmlTags(sourcePrimaryText) : sourcePrimaryText;
            const cleanedOtherText = activeSection === 'general' ? stripHtmlTags(sourceOtherText) : sourceOtherText;
            try {
                const agentEndpoint = import.meta.env.VITE_AGENT_ENDPOINT;            
                const apiKey = import.meta.env.VITE_API_KEY;
                
                currentPromptContent += "PRIMARY REQUIREMENT DETAILS:\n";
                currentPromptContent += cleanedPrimaryText + "\n\n";

                if (cleanedOtherText.trim()) {
                    currentPromptContent += "OTHER RELATED DETAILS / CONTEXT:\n";
                    currentPromptContent += cleanedOtherText + "\n\n";
                }

                // MODIFIED PROMPT: Explicitly ask AI to include "Generated by AI" in Comments
                currentPromptContent += `Please generate a JSON array of test cases based on these details. Each test case should have the following fields: ID (string) (example: X-001, X-002), Title (string), TestSteps (single string with steps like '1. Step Action:::EXPECTED_RESULT:::Expected Result Text 2. Another Step:::EXPECTED_RESULT:::Another Expected Result Text' - ensure this is PLAIN TEXT with no HTML tags, ready for XML embedding), TestData (string), State (e.g., 'Design'), Priority (1-4), AreaPath (string, e.g., '${project}\\Features\\UserStorySpecificArea' or '${project}\\DefaultArea'), AutomationStatus (string), Tags (e.g., 'UI; Functional'), Description (string), Preconditions (string), Postconditions (string), Comments (string). Ensure 'TestSteps' is a single string that I can can parse into an array later. Focus on functional and edge cases for the PRIMARY REQUIREMENT, and return the response in **JSON format**."`;
                
                //console.log("DEBUG: Final promptContent sent to AI Agent:", currentPromptContent);

                const requestBody = {
                    messages: [
                        { "role": "user", "content": currentPromptContent }
                    ],
                    max_tokens: 10000,
                    temperature: 0.7,
                    response_format: { "type": "json_object" }
                };

                const agentResponse = await fetch(agentEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'api-key': apiKey
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!agentResponse.ok) {
                    const errorData = await agentResponse.text();
                    throw new Error(`Agent API Error: ${agentResponse.status} - ${agentResponse.statusText} - ${errorData}`);
                }

                const result = await agentResponse.json();
                
                const messageContent = result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content
                    ? result.choices[0].message.content
                    : JSON.stringify(result, null, 2);
                setRawAgentResponseString(messageContent);

                let generated = [];
                if (result && result.choices && result.choices.length > 0 && result.choices[0].message && result.choices[0].message.content) {
                    try {
                        let parsedTestCases = JSON.parse(result.choices[0].message.content);
                        if (parsedTestCases && typeof parsedTestCases === 'object' && Array.isArray(parsedTestCases.testCases)) {
                            parsedTestCases = parsedTestCases.testCases;
                        }
                        
                        if (Array.isArray(parsedTestCases)) {
                            generated = parsedTestCases.map(tc => {
                                let combinedDescription = tc.Description || 'N/A';
                                let aiCommentsForHistory = tc.Comments || 'N/A'; // Store AI's raw comments for history

                                // Append AI's comments to description if they exist and are not just "N/A"
                                if (aiCommentsForHistory && aiCommentsForHistory.trim() !== 'N/A') {
                                    combinedDescription += '\n\nAI Insights/Comments:\n' + stripHtmlTags(aiCommentsForHistory);
                                }

                                return {
                                    ...tc,
                                    Description: combinedDescription, // This will be sent to System.Description
                                    steps: parseTestSteps(tc.TestSteps || ''),
                                    aiCommentsForHistory: aiCommentsForHistory, // Original AI comments for System.History
                                    Comments: "Test Case Generated by AI", // This is what shows in the UI table
                                    isInactive: false
                                };
                            });
                        } else {
                            throw new Error("Parsed JSON is not an array of test cases.");
                        }
                    } catch (jsonParseError) {
                        throw new Error(`Failed to parse AI agent's JSON response: ${jsonParseError.message}. Raw content: ${result.choices[0].message.content}`);
                    }
                } else {
                    throw new Error("Agent response structure is unexpected or content is missing.");
                }
                setGeneratedTestCases(generated);
                
                openModal('Test cases generated successfully!', 'info');

            } catch (error) {
                console.error("Error generating test cases:", error);
                setGenerationError('Failed to generate test cases: ' + error.message);
                openModal(`Failed to generate test cases: ${error.message}`, 'info');
            } finally {
                setGeneratingTestCases(false);
            }
            // reader.readAsText(file);
            // openModal(`Document selected: ${file.name}. Content processing done`);
            // console.log("Selected document file:", file);
        }
        // Reset the input value to allow selecting the same file again if needed
        event.target.value = null;
    };

    // New handler for image file selection
    const handleImageFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const newFile = {
                id: Date.now() + Math.random(), // Unique ID
                name: file.name,
                type: 'image'
            };
            setUploadedFiles(prevFiles => [...prevFiles, newFile]);
            openModal(`Image selected: ${file.name}. Content processing functionality coming soon!`);
            console.log("Selected image file:", file);
        }
        // Reset the input value
        event.target.value = null;
    };

    // New handler to remove an uploaded file from the list
    const handleRemoveFile = (id) => {
        setUploadedFiles(prevFiles => prevFiles.filter(file => file.id !== id));
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 font-inter text-gray-800 antialiased">
            {modalOpen && (
                <CustomModal
                    message={modalMessage}
                    type={modalType}
                    onConfirm={modalOnConfirm}
                    onClose={closeModal}
                    confirmButtonClass={modalConfirmButtonClass}
                />
            )}

            <header className="text-center mb-10 relative">
                <h1 className="text-2xl font-extrabold text-blue-800 mb-2">
                    Test Case Generator
                </h1>
                {userId && (
                    <p className="text-sm text-gray-500 mt-2">
                        User ID: <span className="font-mono bg-gray-200 px-2 py-1 rounded-md">{userId}</span>
                    </p>
                )}
                <div className="absolute top-4 right-6 flex space-x-4">
                    <button
                        onClick={() => {
                            setActiveSection('general');
                            setUploadedFiles([]); // Clear uploaded files
                            // Removed setGeneratedTestCases([]) and setGeneratedForSection(null)
                        }}
                        className={`px-4 py-2 rounded-lg font-semibold transition duration-200 shadow-sm ${activeSection === 'general' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => {
                            setActiveSection('ado');
                            setUploadedFiles([]); // Clear uploaded files
                            // Removed setGeneratedTestCases([]) and setGeneratedForSection(null)
                        }}
                        className={`px-4 py-2 rounded-lg font-semibold transition duration-200 shadow-sm ${activeSection === 'ado' ? (isConnected ? 'bg-green-600 text-white' : 'bg-blue-500 text-white') : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        {isConnected ? 'Connected to ADO' : 'ADO'}
                    </button>
                    {showJiraButton && (
  <button
    onClick={() => {
      setActiveSection('jira');
      setUploadedFiles([]);
    }}
    className={`px-4 py-2 rounded-lg font-semibold transition duration-200 shadow-sm ${
      activeSection === 'jira'
        ? 'bg-blue-500 text-white'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`}
  >
    Jira
  </button>
)}
                </div>
            </header>

            <div className="max-w-6xl mx-auto space-y-8">
                {activeSection === 'general' && (
                    <div className="bg-white p-8 rounded-xl shadow-lg animate-fade-in">
                        <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">Manual Requirements Input</h2>
                        
                        {/* Primary Requirement Details */}
                        <div className="mb-8 border border-blue-200 rounded-lg p-5 bg-blue-50">
                            <h3 className="text-xl font-semibold text-blue-700 mb-4">Primary Requirement Details</h3>
                            <textarea
                                placeholder="Enter the core user story, feature, or main requirement details here (max 10000 characters). This will be the primary focus for test case generation."
                                rows="8"
                                maxLength="10000"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                                value={primaryRequirementsText}
                                onChange={(e) => setPrimaryRequirementsText(e.target.value)}
                            ></textarea>
                            <p className="text-sm text-gray-500 text-right mt-1">
                                {primaryRequirementsText.length} / 10000 characters
                            </p>
                        </div>

                        {/* Other Related Details */}
                        <div className="mb-8 border border-purple-200 rounded-lg p-5 bg-purple-50">
                            <h3 className="text-xl font-semibold text-purple-700 mb-4">Other Related Details / Context</h3>
                            <textarea
                                placeholder="Enter any related epic details, linked user stories, or general contextual information that might be helpful for test case generation (max 10000 characters)."
                                rows="8"
                                maxLength="10000"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                                value={otherRequirementsText}
                                onChange={(e) => setOtherRequirementsText(e.target.value)}
                            ></textarea>
                            <p className="text-sm text-gray-500 text-right mt-1">
                                {otherRequirementsText.length} / 10000 characters
                            </p>
                        </div>

                        {/* Uploaded Files List */}
                        {uploadedFiles.length > 0 && (
                            <div className="mb-6 p-4 bg-gray-100 rounded-lg border border-gray-200 shadow-sm">
                                <h4 className="text-md font-semibold text-gray-700 mb-2">Attached Documents/Images:</h4>
                                <ul className="list-disc pl-5">
                                    {uploadedFiles.map(file => (
                                        <li key={file.id} className="flex items-center justify-between text-sm text-gray-600 py-1">
                                            <span>{file.name} ({file.type})</span>
                                            <button
                                                onClick={() => handleRemoveFile(file.id)}
                                                className="ml-2 p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        <div className="flex justify-end space-x-4 mt-6"> {/* Changed justify-start to justify-end */}
                            <input type="file" ref={documentInputRef} onChange={handleDocumentFileChange} className="hidden" accept=".doc,.docx,.pdf,.txt,.html,.md" />
                            <button
                                onClick={() => triggerFileInput(documentInputRef)}
                                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-200 shadow-sm disabled:opacity-50"
                                disabled={generatingTestCases}
                            >
                                Upload Document
                            </button>
                            <input type="file" ref={imageInputRef} onChange={handleImageFileChange} className="hidden" accept="image/*" />
                            <button
                                onClick={() => triggerFileInput(imageInputRef)}
                                className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-200 shadow-sm disabled:opacity-50"
                                disabled={generatingTestCases}
                            >
                                Upload Image
                            </button>
                            <button
                                onClick={handleGenerateTestCases}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition duration-200 disabled:opacity-50"
                                disabled={
                                    generatingTestCases || 
                                    !primaryRequirementsText.trim()
                                }
                            >
                                {generatingTestCases ? (
                                    <div className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating...
                                    </div>
                                ) : 'Generate Test Cases'}
                            </button>
                        </div>
                        {generationError && <p className="text-red-600 text-sm mt-2">{generationError}</p>}
                    </div>
                    
                )}

                {activeSection === 'ado' && (
                    <>
                        {/* ADO Connection Section (now conditional on !isConnected) */}
                        {!isConnected && (
                            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 animate-fade-in">
                                <h2 className="text-2xl font-bold text-blue-700 mb-4">Connect to ADO</h2>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Organization Name (e.g., myorg)"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                                        value={organization}
                                        onChange={(e) => setOrganization(e.target.value)}
                                        autoComplete="on"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Project Name (e.g., myproject)"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                                        value={project}
                                        onChange={(e) => setProject(e.target.value)}
                                        autoComplete="on"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Personal Access Token (`PAT`)"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                                        value={pat}
                                        onChange={(e) => setPat(e.target.value)}
                                    />
                                    {connectionMessage && (
                                        <p className={`text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>{connectionMessage}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-2">
                                        <span className="font-semibold">Note:</span> Your `PAT` is used directly from your browser for `API` calls and not stored.
                                    </p>
                                    <button
                                        onClick={handleConnect}
                                        className={`w-full py-3 rounded-lg text-white font-semibold transition duration-200 bg-blue-600 hover:bg-blue-700`}
                                    >
                                        Connect
                                    </button>
                                </div>
                            </div>
                        )}

                        {isConnected && (
                            <div className="bg-white p-8 rounded-xl shadow-lg animate-fade-in">
                                <h2 className="text-2xl font-bold text-blue-700 mb-6 text-center">Azure DevOps Requirements</h2>

                                {/* Fetching Area */}
                                <div className="mb-8 border border-blue-200 rounded-lg p-5 bg-blue-50">
                                    <h3 className="text-xl font-semibold text-blue-700 mb-4 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.523 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.523 18.246 18 16.5 18s-3.332.477-4.5 1.253" />
                                        </svg>
                                        Fetch User Story Details
                                    </h3>
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            placeholder="User Story Work Item ID (e.g., 1001)"
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150"
                                            value={userStoryIdInput}
                                            onChange={(e) => setUserStoryIdInput(e.target.value)}
                                        />
                                        <button
                                            onClick={handleFetchUserStories}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition duration-200 disabled:opacity-50"
                                            disabled={fetchingStories}
                                        >
                                            {fetchingStories ? (
                                                <div className="flex items-center justify-center">
                                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Fetching...
                                                </div>
                                            ) : 'Fetch Requirements'}
                                        </button>
                                        {fetchError && <p className="text-red-600 text-sm mt-2">{fetchError}</p>}
                                    </div>
                                </div>

                                {/* Primary Requirement Details (Display Only) */}
                                <div className="mb-8 border border-blue-200 rounded-lg p-5 bg-blue-50">
                                    <h3 className="text-xl font-semibold text-blue-700 mb-4">Primary Requirement Details (From ADO)</h3>
                                    {adoPrimaryRequirementsDisplay ? (
                                        <div 
                                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 overflow-y-auto max-h-60"
                                            dangerouslySetInnerHTML={{ __html: adoPrimaryRequirementsDisplay }}
                                        ></div>
                                    ) : (
                                        <div
                                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed overflow-y-auto max-h-60"
                                            // Using div with contentEditable="false" and text-gray-500 for placeholder effect
                                        >
                                            Primary User Story details will appear here after fetching from ADO.
                                        </div>
                                    )}
                                </div>

                                {/* Other Related Details / Context (Display Only) */}
                                <div className="mb-8 border border-purple-200 rounded-lg p-5 bg-purple-50">
                                    <h3 className="text-xl font-semibold text-purple-700 mb-4">Other Related Details / Context (From ADO)</h3>
                                    {adoOtherRequirementsDisplay ? (
                                        <div
                                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 overflow-y-auto max-h-60"
                                            dangerouslySetInnerHTML={{ __html: adoOtherRequirementsDisplay }}
                                        ></div>
                                    ) : (
                                        <div
                                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed overflow-y-auto max-h-60"
                                        >
                                            Related Epic and other linked User Story details will appear here after fetching from ADO.
                                        </div>
                                    )}
                                </div>

                                {/* Uploaded Files List */}
                                {uploadedFiles.length > 0 && (
                                    <div className="mb-6 p-4 bg-gray-100 rounded-lg border border-gray-200 shadow-sm">
                                        <h4 className="text-md font-semibold text-gray-700 mb-2">Attached Documents/Images:</h4>
                                        <ul className="list-disc pl-5">
                                            {uploadedFiles.map(file => (
                                                <li key={file.id} className="flex items-center justify-between text-sm text-gray-600 py-1">
                                                    <span>{file.name} ({file.type})</span>
                                                    <button
                                                        onClick={() => handleRemoveFile(file.id)}
                                                        className="ml-2 p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                <div className="flex justify-end space-x-4 mt-6"> {/* Changed justify-start to justify-end */}
                                    <input type="file" ref={documentInputRef} onChange={handleDocumentFileChange} className="hidden" accept=".doc,.docx,.pdf,.txt,.html,.md" />
                                    <button
                                        onClick={() => triggerFileInput(documentInputRef)}
                                        className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-200 shadow-sm disabled:opacity-50"
                                        disabled={generatingTestCases}
                                    >
                                        Upload Document
                                    </button>
                                    <input type="file" ref={imageInputRef} onChange={handleImageFileChange} className="hidden" accept="image/*" />
                                    <button
                                        onClick={() => triggerFileInput(imageInputRef)}
                                        className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-200 shadow-sm disabled:opacity-50"
                                        disabled={generatingTestCases}
                                    >
                                        Upload Image
                                    </button>
                                    <button
                                        onClick={handleGenerateTestCases}
                                        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition duration-200 disabled:opacity-50"
                                        disabled={!adoPrimaryRequirementsDisplay.trim() || generatingTestCases}
                                    >
                                        {generatingTestCases ? (
                                            <div className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Generating...
                                            </div>
                                        ) : 'Generate Test Cases'}
                                    </button>
                                </div>
                                {generationError && <p className="text-red-600 text-sm mt-2">{generationError}</p>}
                            </div>
                        )}
                    </>
                )}

                {activeSection === 'jira' && (
                    <div className="bg-white p-8 rounded-xl shadow-lg text-center animate-fade-in">
                        <h2 className="text-3xl font-bold text-blue-700 mb-4">Jira Integration (Coming Soon)</h2>
                        <p className="text-gray-700">This section will contain features for Jira integration.</p>
                        {/* Uploaded Files List */}
                        {uploadedFiles.length > 0 && (
                            <div className="mb-6 p-4 bg-gray-100 rounded-lg border border-gray-200 shadow-sm">
                                <h4 className="text-md font-semibold text-gray-700 mb-2">Attached Documents/Images:</h4>
                                <ul className="list-disc pl-5">
                                    {uploadedFiles.map(file => (
                                        <li key={file.id} className="flex items-center justify-between text-sm text-gray-600 py-1">
                                            <span>{file.name} ({file.type})</span>
                                            <button
                                                onClick={() => handleRemoveFile(file.id)}
                                                className="ml-2 p-1 rounded-full text-red-500 hover:bg-red-100 transition duration-150"
                                            >
                                                <X className="h-4 w-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="flex justify-end space-x-4 mt-6"> {/* Changed justify-start to justify-end */}
                                    <input type="file" ref={documentInputRef} onChange={handleDocumentFileChange} className="hidden" accept=".doc,.docx,.pdf,.txt,.html,.md" />
                                    <button
                                        onClick={() => triggerFileInput(documentInputRef)}
                                        className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-200 shadow-sm disabled:opacity-50"
                                        disabled={generatingTestCases}
                                    >
                                        Upload Document
                                    </button>
                                    <input type="file" ref={imageInputRef} onChange={handleImageFileChange} className="hidden" accept="image/*" />
                                    <button
                                        onClick={() => triggerFileInput(imageInputRef)}
                                        className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition duration-200 shadow-sm disabled:opacity-50"
                                        disabled={true} /* Always disabled for Jira until integrated */
                                    >
                                        Generate Test Cases
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Raw Agent Response section is now completely removed */}

                    {/* New: Generated Test Cases Table - Only renders if generated for the active section */}
                    {generatedTestCases.length > 0 && activeSection === generatedForSection && (
                        <div className={`mt-10 bg-white p-8 rounded-xl shadow-lg max-w-full mx-auto animate-fade-in ${hasPushedAllSuccessfully ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-3xl font-bold text-blue-800 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 112-2h2a2 2 0 112 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    Generated Test Cases ({generatedTestCases.filter(tc => !tc.isInactive).length} selected)
                                </h2>
                                {/* Export to Excel button (only for General section) */}
                                {activeSection === 'general' && generatedTestCases.length > 0 && (
                                    <button
                                        onClick={handleExportToExcel}
                                        className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition duration-200 shadow-md flex items-center"
                                    >
                                        <FaFileExcel className="h-5 w-5 mr-2 text-white" />
                                        Export to Excel
                                    </button>
                                )}
                                {/* Push All to ADO button (only for ADO section) */}
                                {activeSection === 'ado' && generatedTestCases.length > 0 && (
                                    <button
                                        onClick={handlePushAllToAzure}
                                        className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-200 shadow-md disabled:opacity-50 flex items-center"
                                        disabled={pushingAllToAdo || !isConnected || hasPushedAllSuccessfully}
                                    >
                                        {pushingAllToAdo ? (
                                            <div className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Pushing All...
                                            </div>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 10-2 0v2H7a1 10 2h2v2a1 102 0v-2h2a1 100-2h-2V7z" clipRule="evenodd" />
                                                </svg>
                                                Push All to ADO
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50"><tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[360px]">Description</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Test Steps</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Data</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
                                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr></thead>
                                    <tbody className="bg-white divide-y divide-gray-200">{
                                        generatedTestCases.map((testCase, index) => (
                                            <tr key={index} className={`hover:bg-gray-50 ${testCase.isInactive ? 'opacity-50 bg-gray-100 italic' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{testCase.ID}</td>
                                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-700">{testCase.Title}</td>
                                                {/* Combined Description, Preconditions, Postconditions */}
                                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-700 min-w-[360px]" style={{ whiteSpace: 'pre-wrap' }}>
                                                    <strong>Description:</strong> {testCase.Description || 'N/A'}<br/><br/>
                                                    <strong>Preconditions:</strong> {testCase.Preconditions || 'N/A'}<br/><br/>
                                                    <strong>Postconditions:</strong> {testCase.Postconditions || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-700 min-w-[360px] overflow-hidden text-ellipsis whitespace-normal">
                                                    <ul className="list-decimal pl-5">
                                                        {/* Ensure testCase.steps is an array of {action, expected} objects */}
                                                        {Array.isArray(testCase.steps) && testCase.steps.map((step, sIdx) => (
                                                            <li key={sIdx} className="mb-1 text-xs">
                                                                <strong>Action:</strong> {step.action} <br/>
                                                                <strong>Expected Result:</strong> {step.expected} 
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </td>
                                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-700">{testCase.TestData}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{testCase.Priority}</td>
                                                <td className="px-6 py-4 whitespace-normal text-sm text-gray-700">{testCase.Comments}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                                    {testCase.isInactive ? (
                                                        <button
                                                            onClick={() => handleUndoMarkTestCaseAsInactive(index)}
                                                            className="inline-flex items-center p-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-150"
                                                            disabled={hasPushedAllSuccessfully}
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleMarkTestCaseAsInactive(index)}
                                                            className="inline-flex items-center p-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150"
                                                            disabled={hasPushedAllSuccessfully}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>                        
                    )}
                    {generatedTestCases.length > 0 && (
                        <div className="mt-6">
                            <label className="block text-sm font-medium mb-2 text-gray-700">
                            Suggest correction or improvement:
                            </label>
                            <textarea
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            rows={4}
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            placeholder="E.g., Add changes to the user story or test case details..."
                            />
                            <button
                            onClick={handleRegenerateTestCases}
                            disabled={isLoading}
                            className={`mt-3 px-5 py-2 rounded ${isLoading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                            >
                            {isLoading ? 'Regenerating...' : 'Regenerate Test Cases'}
                            </button>
                        </div>
                    )}
                    <footer className="text-center mt-12 text-gray-500 text-sm">
                        <p>&copy; {new Date().getFullYear()} Test Case Generator. All rights reserved.</p>
                    </footer>
                </div>
            );
        }

export default TestCaseGeneratorApp;
