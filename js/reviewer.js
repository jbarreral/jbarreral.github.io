/* 
    Resume Reviewer Logic
    Simulates AI analysis using Regex and Heuristics
    Includes:
    - PDF/DOCX Text Extraction
    - Smart Keyword Filtering (Ignoring "Junior", "Manager", etc.)
    - Australian English Spelling Check
    - XYZ Impact Formula Check
*/

const messages = [
    "Parsing resume structure...",
    "Extracting technical skills from Job Description...",
    "Filtering out generic buzzwords...",
    "Analyzing impact metrics (XYZ Formula)...",
    "Checking spelling (Australian English)...",
    "Finalizing review..."
];

// Data Dictionaries
const strongVerbs = ["Spearheaded", "Engineered", "Architected", "Delivered", "Optimised", "Reduced", "Increased", "Generated", "Implemented", "Revamped"];
const weakVerbs = ["Helped", "Worked on", "Responsible for", "Assisted", "Participated in", "Handled"];
const usSpelling = { "color": "colour", "optimize": "optimise", "analyze": "analyse", "behavior": "behaviour", "center": "centre", "meter": "metre", "program": "programme", "catalog": "catalogue" };

// BLOCKLIST: Words the AI should IGNORE even if they are capitalized in the JD.
const ignoredKeywords = new Set([
    // Common English Stop Words & Starters
    "the", "and", "for", "with", "this", "that", "have", "from", "will", "your", "are", "who", "about", 
    "what", "when", "where", "which", "their", "they", "them", "does", "also", "into", "other", "more", 
    "some", "these", "those", "can", "could", "would", "should", "than", "then", "over", "under", "after", 
    "before", "within", "without", "through", "during", "between", "please", "note", "contact", "apply",
    
    // Common Spanish Stop Words (since you had Spanish results)
    "estamos", "buscamos", "participar", "traducir", "trabajar", "ayudar", "para", "por", "con", "los", 
    "las", "una", "uno", "del", "que", "como", "mas", "sus", "nos", "les", "esta", "este", "gran", "parte",
    
    // Generic Job Titles & Corporate Jargon (Not Skills)
    "junior", "senior", "manager", "lead", "head", "director", "associate", "intern", "vp", "ceo", "cto",
    "role", "team", "work", "job", "position", "career", "opportunity", "company", "client", "candidate",
    "experience", "years", "skills", "requirements", "responsibilities", "qualifications", "description",
    "degree", "bachelor", "master", "diploma", "phd", "mba", "summary", "location", "remote", "hybrid",
    "onsite", "salary", "benefits", "joining", "world", "people", "culture", "environment", "growth",
    "shakers", "movers", "innovative", "dynamic", "exciting", "equal", "employer", "gender", "sexual", 
    "orientation", "disability", "status", "veteran", "national", "origin", "identity", "expression"
]);

// --- FILE UPLOAD HANDLING ---
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    const resumeTextarea = document.getElementById('resumeInput');
    
    // Show a temporary message
    resumeTextarea.value = "Extracting text from file... please wait.";

    if (fileType === 'pdf') {
        extractTextFromPDF(file, resumeTextarea);
    } else if (fileType === 'docx') {
        extractTextFromDOCX(file, resumeTextarea);
    } else if (fileType === 'txt') {
        const reader = new FileReader();
        reader.onload = (e) => resumeTextarea.value = e.target.result;
        reader.readAsText(file);
    } else {
        alert("Unsupported file format. Please upload PDF, DOCX, or TXT.");
        resumeTextarea.value = "";
    }
}

function extractTextFromPDF(file, outputElement) {
    const fileReader = new FileReader();
    fileReader.onload = function() {
        const typedarray = new Uint8Array(this.result);

        pdfjsLib.getDocument(typedarray).promise.then(async function(pdf) {
            let fullText = "";
            // Loop through all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(" ");
                fullText += pageText + "\n";
            }
            outputElement.value = fullText;
        }).catch(function(error) {
            console.error(error);
            outputElement.value = "Error reading PDF. Please copy/paste text manually.";
        });
    };
    fileReader.readAsArrayBuffer(file);
}

function extractTextFromDOCX(file, outputElement) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const arrayBuffer = event.target.result;
        mammoth.extractRawText({arrayBuffer: arrayBuffer})
            .then(function(result) {
                outputElement.value = result.value; 
            })
            .catch(function(err) {
                console.log(err);
                outputElement.value = "Error reading DOCX. Please copy/paste text manually.";
            });
    };
    reader.readAsArrayBuffer(file);
}

// --- ANALYSIS LOGIC ---

function startAnalysis() {
    const jd = document.getElementById('jdInput').value;
    const resume = document.getElementById('resumeInput').value;

    if(jd.length < 50 || resume.length < 50) {
        alert("Please provide both a Job Description and a Resume (Text or File) to begin.");
        return;
    }

    const loader = document.getElementById('loader');
    const msgDiv = document.getElementById('loadingMsg');
    loader.style.display = 'flex';
    document.getElementById('results').style.display = 'none';

    // Play Loading Sequence
    let step = 0;
    const interval = setInterval(() => {
        if(step < messages.length) {
            msgDiv.innerText = messages[step];
            step++;
        } else {
            clearInterval(interval);
            performAnalysis(jd, resume);
        }
    }, 800); 
}

function performAnalysis(jd, resume) {
    let score = 0;
    let suggestions = {
        "Job Description Alignment (ATS)": [],
        "Impact & XYZ Formula (Manager View)": [],
        "Formatting & Structure": [],
        "Language & Tone (AU English)": []
    };

    // A. INTELLIGENT KEYWORD MATCHING
    // 1. Extract all words that look like proper nouns (Capitalized)
    const jdTokens = jd.match(/\b[A-Z][a-zA-Z0-9+]+\b/g) || [];
    
    // 2. Filter using the Blocklist
    const uniqueJdKeywords = [...new Set(jdTokens)].filter(w => {
        // Must be longer than 2 chars
        if (w.length < 3) return false;
        // Check if it's in the ignore list (case insensitive)
        if (ignoredKeywords.has(w.toLowerCase())) return false;
        return true;
    });
    
    let matchedKeywords = 0;
    let missingKeywords = [];

    uniqueJdKeywords.forEach(keyword => {
        if(resume.includes(keyword)) {
            matchedKeywords++;
        } else {
            missingKeywords.push(keyword);
        }
    });

    // Score Calculation for Keywords
    // We cap the denominator to avoid punishing for massive JDs
    const scoreDenominator = Math.min(uniqueJdKeywords.length, 15) || 1;
    const keywordRatio = matchedKeywords / scoreDenominator;
    score += Math.min(30, Math.ceil(keywordRatio * 30));

    if(missingKeywords.length > 0) {
        // Show only top 8 missing keywords to keep it clean
        const topMissing = missingKeywords.slice(0, 8).join(", ");
        suggestions["Job Description Alignment (ATS)"].push(
            `<strong>Missing Key Terms:</strong> Your resume is missing potential high-value keywords found in the JD. Consider integrating: <span class="highlight">${topMissing}</span>.`
        );
    } else {
        suggestions["Job Description Alignment (ATS)"].push("Great job! Your resume matches the key terminology found in the Job Description.");
    }

    // B. IMPACT & XYZ FORMULA
    const sentences = resume.split('.');
    let xyzCount = 0;
    let weakSentences = [];

    sentences.forEach(sentence => {
        // Look for numbers, percentages, currency
        if (/\d+%|\$\d+|\d+/.test(sentence)) {
            xyzCount++;
        } else if (sentence.length > 30) { 
            // Only check long sentences for weak verbs
            weakVerbs.forEach(weak => {
                if (sentence.toLowerCase().includes(" " + weak.toLowerCase() + " ")) {
                    weakSentences.push(sentence.trim());
                }
            });
        }
    });

    if(xyzCount >= 4) score += 40;
    else score += (xyzCount * 10);

    if(xyzCount < 4) {
        suggestions["Impact & XYZ Formula (Manager View)"].push(
            `<strong>Lack of Quantifiable Metrics:</strong> Managers need ROI. You only have ${xyzCount} sentences with clear metrics. Use the Google formula: <em>"Accomplished [X] as measured by [Y], by doing [Z]"</em>.`
        );
    }

    if(weakSentences.length > 0) {
        // Show just the first weak sentence as an example
        suggestions["Impact & XYZ Formula (Manager View)"].push(
            `<strong>Weak Action Verbs:</strong> Replace passive phrases like "Helped" or "Worked on" with strong drivers. Found in: <em>"${weakSentences[0].substring(0, 60)}..."</em>. Try: <span class="highlight">${strongVerbs.slice(0,5).join(", ")}</span>.`
        );
    }

    // C. SPELLING & LOCALIZATION (Australian English)
    let spellingErrors = 0;
    let errorsFound = [];
    for (const [us, au] of Object.entries(usSpelling)) {
        // Regex to find whole word matches
        const regex = new RegExp(`\\b${us}\\b`, 'gi');
        if(regex.test(resume)) {
            spellingErrors++;
            errorsFound.push(`${us} → ${au}`);
        }
    }

    if(spellingErrors === 0) {
        score += 15;
    } else {
        score += Math.max(0, 15 - (spellingErrors * 5));
        suggestions["Language & Tone (AU English)"].push(
            `<strong>US vs AU Spelling:</strong> Detected American spelling. For Australian applications, switch: <span class="highlight">${errorsFound.join(", ")}</span>.`
        );
    }

    // D. FORMATTING CHECK
    const hasEmail = /@/.test(resume);
    const hasLinkedIn = /linkedin\.com/i.test(resume); // case insensitive check
    
    if(hasEmail && hasLinkedIn) score += 15;
    else {
        if(!hasEmail) suggestions["Formatting & Structure"].push("<strong>Contact Info:</strong> Could not detect an email address.");
        if(!hasLinkedIn) suggestions["Formatting & Structure"].push("<strong>Social Proof:</strong> LinkedIn URL missing. 95% of recruiters check LinkedIn.");
        score += 5;
    }

    renderResults(score, suggestions);
}

function renderResults(score, suggestions) {
    document.getElementById('loader').style.display = 'none';
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';

    const scoreCircle = document.getElementById('scoreCircle');
    const scoreText = document.getElementById('scoreText');
    
    // Ensure score doesn't exceed 100
    const finalScore = Math.min(100, score);
    
    scoreCircle.style.background = `conic-gradient(#fff ${finalScore}%, #333 ${finalScore}% 100%)`;
    scoreText.innerText = `${finalScore}%`;

    const container = document.getElementById('feedbackContainer');
    container.innerHTML = ""; 

    for (const [category, items] of Object.entries(suggestions)) {
        if(items.length === 0) continue; 

        const html = `
            <div class="category-item">
                <div class="category-header" onclick="toggleAccordion(this)">
                    ${category}
                    <span>▼</span>
                </div>
                <div class="category-content">
                    <ul>
                        ${items.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
        container.innerHTML += html;
    }
}

function toggleAccordion(header) {
    const content = header.nextElementSibling;
    const isOpen = content.style.display === "block";
    document.querySelectorAll('.category-content').forEach(el => el.style.display = 'none');
    content.style.display = isOpen ? "none" : "block";
}