/* 
    Resume Reviewer Logic
    Simulates AI analysis using Regex and Heuristics
    Now supports PDF and DOCX extraction client-side
*/

const messages = [
    "Parsing resume structure...",
    "Extracting keywords from Job Description...",
    "Scanning for ATS compatibility...",
    "Analyzing impact metrics (XYZ Formula)...",
    "Checking spelling (Australian English)...",
    "Finalizing review..."
];

// Data Dictionaries
const strongVerbs = ["Spearheaded", "Engineered", "Architected", "Delivered", "Optimised", "Reduced", "Increased", "Generated"];
const weakVerbs = ["Helped", "Worked on", "Responsible for", "Assisted", "Participated in"];
const usSpelling = { "color": "colour", "optimize": "optimise", "analyze": "analyse", "behavior": "behaviour", "center": "centre", "meter": "metre" };

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

    // A. JD KEYWORD MATCHING
    const jdTokens = jd.match(/\b[A-Z][a-zA-Z]+\b/g) || [];
    const uniqueJdKeywords = [...new Set(jdTokens)].filter(w => w.length > 3 && !["The", "And", "For", "With", "This"].includes(w));
    
    let matchedKeywords = 0;
    let missingKeywords = [];

    uniqueJdKeywords.forEach(keyword => {
        if(resume.includes(keyword)) {
            matchedKeywords++;
        } else {
            missingKeywords.push(keyword);
        }
    });

    const keywordRatio = matchedKeywords / (uniqueJdKeywords.length || 1);
    score += Math.min(30, Math.ceil(keywordRatio * 30));

    if(missingKeywords.length > 0) {
        suggestions["Job Description Alignment (ATS)"].push(
            `<strong>Missing Keywords:</strong> Your resume is missing key terms found in the JD. Recruiters and AI scan for these. Consider adding: <span class="highlight">${missingKeywords.slice(0, 10).join(", ")}</span>.`
        );
    } else {
        suggestions["Job Description Alignment (ATS)"].push("Great job! Your resume matches the key terminology found in the Job Description.");
    }

    // B. IMPACT & XYZ FORMULA
    const sentences = resume.split('.');
    let xyzCount = 0;
    let weakSentences = [];

    sentences.forEach(sentence => {
        if (/\d+%|\$\d+|\d+/.test(sentence)) {
            xyzCount++;
        } else if (sentence.length > 20) {
            weakVerbs.forEach(weak => {
                if (sentence.toLowerCase().includes(weak.toLowerCase())) {
                    weakSentences.push(sentence.trim());
                }
            });
        }
    });

    if(xyzCount >= 3) score += 40;
    else score += (xyzCount * 10);

    if(xyzCount < 3) {
        suggestions["Impact & XYZ Formula (Manager View)"].push(
            `<strong>Lack of Metrics:</strong> Managers look for ROI. You only have ${xyzCount} sentences with quantifiable metrics. Use the formula: "Accomplished [X] as measured by [Y], by doing [Z]".`
        );
    }

    if(weakSentences.length > 0) {
        suggestions["Impact & XYZ Formula (Manager View)"].push(
            `<strong>Weak Action Verbs:</strong> Replace passive words with strong drivers. Found in: "<em>${weakSentences[0]}...</em>". Try using: <span class="highlight">${strongVerbs.slice(0,5).join(", ")}</span>.`
        );
    }

    // C. SPELLING & LOCALIZATION
    let spellingErrors = 0;
    for (const [us, au] of Object.entries(usSpelling)) {
        const regex = new RegExp(`\\b${us}\\w*\\b`, 'gi');
        if(regex.test(resume)) {
            spellingErrors++;
            suggestions["Language & Tone (AU English)"].push(
                `Found US spelling "<strong>${us}</strong>". Change to Australian/UK spelling "<strong>${au}</strong>".`
            );
        }
    }

    if(spellingErrors === 0) score += 15;
    else score += Math.max(0, 15 - (spellingErrors * 5));

    // D. FORMATTING CHECK
    const hasEmail = /@/.test(resume);
    const hasLinkedIn = /linkedin\.com/.test(resume);
    
    if(hasEmail && hasLinkedIn) score += 15;
    else {
        if(!hasEmail) suggestions["Formatting & Structure"].push("<strong>Contact Info:</strong> Could not detect an email address. Ensure it is clearly visible.");
        if(!hasLinkedIn) suggestions["Formatting & Structure"].push("<strong>Social Proof:</strong> LinkedIn URL missing. Recruiters almost always check LinkedIn.");
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
    
    scoreCircle.style.background = `conic-gradient(#fff ${score}%, #333 ${score}% 100%)`;
    scoreText.innerText = `${score}%`;

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