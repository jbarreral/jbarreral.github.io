/* 
    Resume Reviewer Logic v2.0 (Optimized)
    - PDF/DOCX Text Extraction
    - Dual-Language Support (EN/ES)
    - Anti-Fluff Filtering (Removes generic verbs/nouns)
    - Hard Skill Prioritization
    - XYZ Impact Analysis
*/

const messages = [
    "Reading file format...",
    "Filtering corporate fluff & generic verbs...",
    "Identifying hard skills (Tech/Tools/Methodologies)...",
    "Calculating Metric Density (XYZ Formula)...",
    "Checking Australian English compliance...",
    "Generating strategic feedback..."
];

// --- 1. DATA DICTIONARIES (The Knowledge Base) ---

const strongVerbs = [
    "Spearheaded", "Engineered", "Architected", "Delivered", "Optimised", 
    "Reduced", "Increased", "Generated", "Implemented", "Revamped", "Orchestrated", 
    "Formulated", "Negotiated", "Accelerated", "Automated"
];

const weakVerbs = [
    "Helped", "Worked on", "Responsible for", "Assisted", "Participated in", 
    "Handled", "Duties included", "Tasked with", "Supported"
];

// Australian English Mapping
const usSpelling = { 
    "color": "colour", "optimize": "optimise", "analyze": "analyse", "behavior": "behaviour", 
    "center": "centre", "meter": "metre", "program": "programme", "catalog": "catalogue",
    "modeling": "modelling", "labeled": "labelled", "organization": "organisation",
    "prioritize": "prioritise", "finalized": "finalised"
};

// THE BLOCKLIST: Words that are NEVER skills (EN & ES)
// derived from analyzing standard LinkedIn/Indeed boilerplate.
const ignoredKeywords = new Set([
    // --- ENGLISH STOP WORDS & FLUFF ---
    "the", "and", "for", "with", "this", "that", "have", "from", "will", "your", "are", "who", "about", 
    "what", "when", "where", "which", "their", "they", "them", "does", "also", "into", "other", "more", 
    "some", "these", "those", "can", "could", "would", "should", "than", "then", "over", "under", "after", 
    "before", "within", "without", "through", "during", "between", "please", "note", "contact", "apply",
    "junior", "senior", "manager", "lead", "head", "director", "associate", "intern", "vp", "ceo", "cto",
    "role", "team", "work", "job", "position", "career", "opportunity", "company", "client", "candidate",
    "experience", "years", "skills", "requirements", "responsibilities", "qualifications", "description",
    "degree", "bachelor", "master", "diploma", "phd", "mba", "summary", "location", "remote", "hybrid",
    "onsite", "salary", "benefits", "joining", "world", "people", "culture", "environment", "growth",
    "shakers", "movers", "innovative", "dynamic", "exciting", "equal", "employer", "gender", "sexual", 
    "orientation", "disability", "status", "veteran", "national", "origin", "identity", "expression",
    "full-stack", "fullstack", "founders", "c-level", "daily", "weekly", "monthly", "ensure", "drive",
    "collaborate", "support", "assist", "manage", "create", "develop", "maintain", "execute", "perform",
    "provide", "identify", "participate", "translate", "review", "monitor", "focus", "detail", "oriented",
    "passionate", "motivated", "enthusiastic", "excellent", "good", "strong", "proven", "track", "record",
    "ability", "capability", "knowledge", "understanding", "proficiency", "fluent", "native", "plus",
    "bonus", "ideal", "ideally", "must", "nice", "preferred", "willing", "able", "ready", "start",

    // --- SPANISH STOP WORDS & FLUFF (Based on your feedback) ---
    "estamos", "buscamos", "participar", "traducir", "trabajar", "ayudar", "para", "por", "con", "los", 
    "las", "una", "uno", "del", "que", "como", "mas", "sus", "nos", "les", "esta", "este", "gran", "parte",
    "crear", "utilizar", "impulsar", "liderar", "mejorar", "rediseñar", "colaborando", "transformando",
    "gestion", "herramientas", "detalle", "seras", "hacer", "haras", "soluciones", "necesidades",
    "mantener", "priorizar", "vision", "realidad", "patrones", "oportunidades", "decisiones",
    "requisitos", "experiencia", "capacidad", "dominio", "empatia", "disponibilidad", "plus",
    "cultura", "confianza", "responsabilidad", "modelo", "ritmo", "feedback", "transparentes", 
    "aprendizaje", "equipo", "ambicioso", "ownership", "impacto", "vida", "interfaz", "automatizacion",
    "condiciones", "contrato", "proyecto", "modalidad", "ejecutivo", "indefinido", "freelance",
    "analisis", "diseño", "desarrollo", "lanzamiento", "continua", "usuario", "cliente", "producto",
    "servicio", "empresa", "compañia", "sector", "industria", "mercado", "negocio", "estrategia",
    "funcionalidad", "tarea", "actividad", "objetivo", "meta", "resultado", "exito", "nivel", "grado",
    "titulacion", "formacion", "educacion", "idioma", "ingles", "español", "frances", "italiano",
    "oficina", "madrid", "barcelona", "valencia", "sevilla", "remoto", "hibrido", "presencial",
    "jornada", "completa", "parcial", "intensiva", "horario", "flexible", "salario", "retribucion",
    "beneficio", "social", "medico", "seguro", "ticket", "restaurante", "transporte", "gimnasio",
    "vacaciones", "dias", "libre", "asunto", "propio", "cumpleaños", "navidad", "verano",
    "alta", "baja", "media", "intermedia", "avanzada", "experto", "senior", "junior", "lead"
]);

// --- 2. FILE UPLOAD HANDLING (Unchanged) ---
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

// --- 3. ANALYSIS LOGIC (Optimized) ---

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

    // --- A. INTELLIGENT KEYWORD MATCHING (FILTERED) ---
    // Match Uppercase words, OR words with dashes/numbers (like "0-to-1", "B2B", "SaaS")
    // This Regex finds: "Python", "SQL", "Full-Stack", "Go-to-Market"
    const jdTokens = jd.match(/\b([A-Z][a-zA-Z0-9]+|[a-zA-Z0-9]+-[a-zA-Z0-9]+)\b/g) || [];
    
    // Strict Filtering
    const uniqueJdKeywords = [...new Set(jdTokens)].filter(w => {
        const cleanWord = w.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanWord.length < 2) return false; // Ignore single letters
        if (ignoredKeywords.has(cleanWord)) return false; // Blocklist check
        if (!isNaN(cleanWord)) return false; // Ignore pure numbers
        return true;
    });
    
    let matchedKeywords = 0;
    let missingKeywords = [];

    uniqueJdKeywords.forEach(keyword => {
        // Create regex to match whole word, case insensitive
        // Escape special chars like "+" for C++
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        
        if(regex.test(resume)) {
            matchedKeywords++;
        } else {
            missingKeywords.push(keyword);
        }
    });

    // Score: Reward strictly for high-value matches
    const keywordRatio = matchedKeywords / (uniqueJdKeywords.length || 1);
    score += Math.min(30, Math.ceil(keywordRatio * 40)); // Up to 30 points

    if(missingKeywords.length > 0) {
        // Show only top 10 relevant keywords
        const topMissing = missingKeywords.slice(0, 10).join(", ");
        suggestions["High-Value Keywords (ATS)"].push(
            `<strong>Potential Hard Skills Missing:</strong> The JD emphasizes these specific terms. Ensure you mention them if you have the skill: <br><br><span class="highlight" style="font-size:1.1em">${topMissing}</span>`
        );
    } else {
        suggestions["High-Value Keywords (ATS)"].push("Excellent. You have covered the primary technical/hard skills mentioned in the JD.");
        score += 5;
    }

    // --- B. IMPACT & XYZ FORMULA ---
    const sentences = resume.split(/[.!?\n]+/); // Split by punctuation or newlines
    const significantSentences = sentences.filter(s => s.trim().length > 30); // Ignore short lines/headers
    let xyzCount = 0;
    let weakSentences = [];

    significantSentences.forEach(sentence => {
        // Regex for metrics: 20%, $50k, 10M, 5x, 0-1
        const hasMetric = /(\d+%|\$\d+|\d+k|\d+M|\d+x|\d+-\d+|\d+\s\+)/i.test(sentence);
        
        if (hasMetric) {
            xyzCount++;
        } else {
            // Only flag weak verbs if no metric is present
            weakVerbs.forEach(weak => {
                if (sentence.toLowerCase().includes(" " + weak.toLowerCase() + " ")) {
                    if(weakSentences.length < 2) weakSentences.push(sentence.trim());
                }
            });
        }
    });

    // Metric Density: We expect ~30% of bullet points to have metrics
    const metricDensity = xyzCount / (significantSentences.length || 1);
    
    if(metricDensity > 0.3 || xyzCount > 5) score += 40;
    else score += (metricDensity * 100); // Scale score based on density

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
        if(!hasLinkedIn) suggestions["Formatting & Contact"].push("<strong>Social Proof:</strong> LinkedIn URL is missing. This is often the first thing a recruiter checks.");
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