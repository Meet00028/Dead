/**
 * Communicates with the local FastAPI backend (Cartographer Engine)
 * The backend handles the Gemini API key and AI processing securely.
 */
export const generateSummary = async (codeContent, fileName) => {
    try {
        // Define the backend URL (ensure your Uvicorn server is running on port 8000)
        const BACKEND_URL = 'http://localhost:8000/api/summarize';

        // Fire the request to the Python engine
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Optional: If you ever add auth to your backend, add tokens here
            },
            body: JSON.stringify({
                code_content: codeContent,
                file_name: fileName
            })
        });

        // Handle HTTP errors (e.g., 500 Internal Server Error)
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Engine returned ${response.status}: ${errorData.detail || 'Unknown Error'}`);
        }

        // Parse the successful response from FastAPI
        const data = await response.json();
        
        // FastAPI returns {"summary": "..."}
        return data.summary;

    } catch (error) {
        console.error('Error communicating with Cartographer Engine:', error);
        
        // Trigger the fallback analyzer if the Python server is offline or fails
        return generateBasicSummary(codeContent, fileName, error.message);
    }
};

// ============================================================================
// Fallback Analysis (Runs in the browser if the backend is unreachable)
// ============================================================================
const generateBasicSummary = (code, fileName, errorMessage) => {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // Basic regex parsing for statistics
    const stats = {
        totalLines: lines.length,
        codeLines: nonEmptyLines.length,
        functions: (code.match(/function\s+\w+|def\s+\w+|class\s+\w+/g) || []).length,
        imports: (code.match(/import\s+|from\s+.*import|#include|require\(/g) || []).length,
    };
    
    const fileType = fileName.split('.').pop().toLowerCase();
    
    return `
### ⚠️ AI Engine Unavailable
*The Python backend could not be reached or returned an error: ${errorMessage}*

**Static Analysis Results:**
* **File Type:** ${getFileTypeDescription(fileType)}
* **Volume:** ${stats.codeLines} Lines of Code (${stats.totalLines} total)
* **Architecture:** ${stats.functions} Functions/Classes defined
* **Dependencies:** ${stats.imports} Import statements detected
    `.trim();
};

const getFileTypeDescription = (extension) => {
    const descriptions = {
        'js': 'JavaScript source file', 'jsx': 'React component file',
        'ts': 'TypeScript source file', 'tsx': 'React TypeScript component',
        'py': 'Python script', 'java': 'Java class file',
        'cpp': 'C++ source file', 'c': 'C source file',
        'h': 'C/C++ header file', 'cs': 'C# source file',
        'php': 'PHP script', 'rb': 'Ruby script',
        'go': 'Go source file', 'rs': 'Rust source file',
        'swift': 'Swift source file', 'kt': 'Kotlin source file',
    };
    return descriptions[extension] || `${extension.toUpperCase()} file`;
};

// We test the connection by hitting the FastAPI health check endpoint
export const testEngineConnection = async () => {
    try {
        const response = await fetch('http://localhost:8000/');
        if (!response.ok) return false;
        
        const data = await response.json();
        return data.status === "Cartographer Engine Online";
    } catch (error) {
        console.warn('Backend Engine not available:', error);
        return false;
    }
};
