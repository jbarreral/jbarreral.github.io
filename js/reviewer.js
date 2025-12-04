/* 
    Resume Reviewer Logic v3.0 (Structural Analysis)
    - PDF/DOCX Text Extraction
    - Context-Aware Keyword Extraction (Solving the "Verb" problem)
    - Anti-Header Detection
    - Australian English Spelling Check
    - XYZ Impact Formula Check
*/

const messages = [
    "Reading file structure...",
    "Ignoring headers and bullet-point verbs...",
    "Extracting mid-sentence Proper Nouns...",
    "Identifying acronyms & technical terms...",
    "Analyzing metric density (XYZ Formula)...",
    "Generating strategic feedback..."
];

// Data Dictionaries
const strongVerbs = [
    "Spearheaded", "Engineered", "Architected", "Delivered", "Optimised", 
    "Reduced", "Increased", "Generated", "Implemented", "Revamped", "Orchestrated", 
    "Formulated", "Negotiated", "Accelerated", "Automated"
];

const weakVerbs = [
    "Helped", "Worked on", "Responsible for", "Assisted", "Participated in", 
    "Handled", "Duties included", "Tasked with", "Supported"
];

const usSpelling = { 
    "color": "colour", "optimize": "optimise", "analyze": "analyse", "behavior": "behaviour", 
    "center": "centre", "meter": "metre", "program": "programme", "catalog": "catalogue",
    "modeling": "modelling", "labeled": "labelled", "organization": "organisation",
    "prioritize": "prioritise", "finalized": "finalised"
};

// --- 1. FILE UPLOAD HANDLING ---
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const fileType = file.name.split('.').pop().toLowerCase();
    const resumeTextarea = document.getElementById('resumeInput');
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
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(" ");
                fullText += pageText + "\n";
            }
            outputElement.value = fullText;
        }).catch(error => { outputElement.value = "Error reading PDF."; });
    };
    fileReader.readAsArrayBuffer(file);
}

function extractTextFromDOCX(file, outputElement) {
    const reader = new FileReader();
    reader.onload = function(event) {
        mammoth.extractRawText({arrayBuffer: event.target.result})
            .then(result => { outputElement.value = result.value; })
            .catch(err => { outputElement.value = "Error reading DOCX."; });
    };
    reader.readAsArrayBuffer(file);
}

// --- 2. STRUCTURAL KEYWORD EXTRACTION (THE CORE FIX) ---

function extractSmartKeywords(text) {
    // Break text into lines to analyze structure
    const lines = text.split(/\n/);
    const candidateKeywords = new Set();
    const rejectedKeywords = new Set();

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (cleanLine.length < 3) return;

        // RULE 1: IGNORE HEADERS
        // If a line is short (<40 chars) and ends in colon, or is just ALL CAPS (like "REQUIREMENTS"), ignore it.
        const isHeader = (cleanLine.endsWith(':') || (cleanLine === cleanLine.toUpperCase() && cleanLine.split(' ').length < 4));
        if (isHeader) return;

        // RULE 2: SPLIT SENTENCE INTO WORDS
        // We split by spaces, but keep punctuation to detect start of sentence
        const words = cleanLine.split(/\s+/);

        words.forEach((word, index) => {
            // Clean punctuation (remove dots, commas, bullets)
            const cleanWord = word.replace(/^[•\-\*]+/, '').replace(/[.,:;()!?]+$/, '');
            
            // Skip empty or tiny words
            if (cleanWord.length < 2) return;

            // CHECK: Is it an Acronym/Tech Term? (ALL CAPS or Mixed Numbers e.g. "B2B", "SaaS", "3D", "SQL")
            const isAcronym = /^[A-Z0-9]+$/.test(cleanWord) && cleanWord.length > 1;
            const isMixedTech = /[a-zA-Z]+[0-9]+|[0-9]+[a-zA-Z]+/.test(cleanWord); // e.g. "0to1", "Win10"
            
            // CHECK: Is it Capitalized? (Proper Noun style)
            // Includes Spanish accents: ÁÉÍÓÚÑ
            const isCapitalized = /^[A-ZÁÉÍÓÚÑ][a-z0-9áéíóúñ]+/.test(cleanWord);

            if (isAcronym || isMixedTech) {
                // Always accept acronyms (SQL, AWS, B2B)
                candidateKeywords.add(cleanWord);
            } else if (isCapitalized) {
                // RULE 3: MID-SENTENCE DETECTION
                // If it's the first word of the line/sentence, it's suspicious (likely a verb like "Crear").
                // If it's NOT the first word, it's likely a skill (like "...using Figma").
                
                if (index === 0) {
                    // It's the first word. Unless we've seen it elsewhere as a skill, mark it as "rejected" for now.
                    // We don't add it yet.
                    rejectedKeywords.add(cleanWord);
                } else {
                    // It's in the middle of a sentence. It's almost certainly a Proper Noun/Skill.
                    // Exclude common stop words that might be capitalized by mistake
                    if (!["The", "And", "With", "For", "Para", "Con", "Las", "Los"].includes(cleanWord)) {
                        candidateKeywords.add(cleanWord);
                    }
                }
            }
        });
    });

    // Final Cleanup: Return candidates. 
    // Note: We deliberately DO NOT include words that ONLY appeared at the start of sentences (rejectedKeywords).
    return Array.from(candidateKeywords);
}


// --- 3. ANALYSIS LOGIC ---

function startAnalysis() {
    const jd = document.getElementById('jdInput').value;
    const resume = document.getElementById('resumeInput').value;

    if(jd.length < 50 || resume.length < 50) {
        alert("Please provide both a Job Description and a Resume to begin.");
        return;
    }

    const loader = document.getElementById('loader');
    const msgDiv = document.getElementById('loadingMsg');
    loader.style.display = 'flex';
    document.getElementById('results').style.display = 'none';

    let step = 0;
    const interval = setInterval(() => {
        if(step < messages.length) {
            msgDiv.innerText = messages[step];
            step++;
        } else {
            clearInterval(interval);
            performAnalysis(jd, resume);
        }
    }, 600); 
}

function performAnalysis(jd, resume) {
    let score = 0;
    let suggestions = {
        "High-Value Keywords (ATS)": [],
        "Manager Impact (XYZ Formula)": [],
        "Formatting & Contact": [],
        "Language & Tone (AU English)": []
    };

    // --- A. INTELLIGENT KEYWORD MATCHING ---
    const extractedKeywords = extractSmartKeywords(jd);
    
    // Filter against Resume
    let matchedKeywords = 0;
    let missingKeywords = [];

    extractedKeywords.forEach(keyword => {
        // Regex for whole word match, case insensitive, escaping special chars (C++, Node.js)
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        
        if(regex.test(resume)) {
            matchedKeywords++;
        } else {
            missingKeywords.push(keyword);
        }
    });

    // Score Calculation (Cap denominator at 15 to be fair)
    const scoreDenominator = Math.min(extractedKeywords.length, 15) || 1;
    const keywordRatio = matchedKeywords / scoreDenominator;
    score += Math.min(30, Math.ceil(keywordRatio * 40)); 

    if(missingKeywords.length > 0) {
        // Sort by length (longer keywords usually more specific)
        const topMissing = missingKeywords.sort((a,b) => b.length - a.length).slice(0, 10).join(", ");
        suggestions["High-Value Keywords (ATS)"].push(
            `<strong>Potential Hard Skills Missing:</strong> Based on analyzing Proper Nouns and Acronyms in the JD (ignoring generic verbs), you might be missing: <br><br><span class="highlight" style="font-size:1.1em">${topMissing}</span>`
        );
    } else {
        suggestions["High-Value Keywords (ATS)"].push("Excellent. You have covered the primary technical/hard skills detected in the JD.");
        score += 5;
    }

    // --- B. IMPACT & XYZ FORMULA ---
    const sentences = resume.split(/[.!?\n]+/); 
    const significantSentences = sentences.filter(s => s.trim().length > 30); 
    let xyzCount = 0;
    let weakSentences = [];

    significantSentences.forEach(sentence => {
        // Regex for metrics: 20%, $50k, 10M, 5x, 0-1
        const hasMetric = /(\d+%|\$\d+|\d+k|\d+M|\d+x|\d+-\d+|\d+\s\+)/i.test(sentence);
        
        if (hasMetric) {
            xyzCount++;
        } else {
            weakVerbs.forEach(weak => {
                if (sentence.toLowerCase().includes(" " + weak.toLowerCase() + " ")) {
                    if(weakSentences.length < 2) weakSentences.push(sentence.trim());
                }
            });
        }
    });

    const metricDensity = xyzCount / (significantSentences.length || 1);
    
    if(metricDensity > 0.3 || xyzCount > 5) score += 40;
    else score += (metricDensity * 100); 

    if(xyzCount < 5) {
        suggestions["Manager Impact (XYZ Formula)"].push(
            `<strong>Low Metric Density:</strong> Only ${xyzCount} of your sentences contain quantifiable data. <br>Managers hire based on ROI. Try to rewrite bullets using: <em>"Achieved [X] as measured by [Y]%, by doing [Z]"</em>.`
        );
    }

    if(weakSentences.length > 0) {
        suggestions["Manager Impact (XYZ Formula)"].push(
            `<strong>Passive Language Detected:</strong> Avoid phrases like "Helped" or "Responsible for". <br>Example found: <em>"${weakSentences[0].substring(0, 60)}..."</em> <br><strong>Fix:</strong> Use power verbs like <em>Engineered, Delivered, Negotiated, Accelerated</em>.`
        );
    }

    // --- C. SPELLING & LOCALIZATION (AU/UK) ---
    let spellingErrors = 0;
    let errorsFound = [];
    for (const [us, au] of Object.entries(usSpelling)) {
        const regex = new RegExp(`\\b${us}\\b`, 'gi');
        if(regex.test(resume)) {
            spellingErrors++;
            if(errorsFound.length < 5) errorsFound.push(`${us} → ${au}`);
        }
    }

    if(spellingErrors === 0) {
        score += 15;
    } else {
        score += Math.max(0, 15 - (spellingErrors * 3));
        suggestions["Language & Tone (AU English)"].push(
            `<strong>Localization Check:</strong> Found American spellings. For AU/UK markets, replace: <span class="highlight">${errorsFound.join(", ")}</span>.`
        );
    }

    // --- D. FORMATTING ---
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(resume);
    const hasLinkedIn = /linkedin\.com/i.test(resume);
    
    if(hasEmail && hasLinkedIn) score += 15;
    else {
        if(!hasEmail) suggestions["Formatting & Contact"].push("<strong>Critical:</strong> No valid email address detected.");
        if(!hasLinkedIn) suggestions["Formatting & Contact"].push("<strong>Social Proof:</strong> LinkedIn URL missing. This is often the first thing a recruiter checks.");
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
    const finalScore = Math.min(100, Math.ceil(score));
    
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