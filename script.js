let quizData = [];
let currentQuestion = 0;
let score = 0;

function handleFileUpload() {
    const fileInput = document.getElementById('file-input');
    const files = fileInput.files;
    if (!files.length) {
        alert("Please select at least one file.");
        return;
    }
    document.getElementById("progress").innerText = "Processing files...";
    const processPromises = [];

    for (let file of files) {
        if (file.type === "application/pdf") {
            processPromises.push(processPDF(file));
        } else if (file.type.startsWith("image/")) {
            processPromises.push(processImage(file));
        }
    }

    Promise.all(processPromises).then(results => {
        const allText = results.join("\n");
        console.log("Extracted Text:", allText);
        quizData = parseQuestionsFromText(allText);
        if (quizData.length === 0) {
            alert("No questions found. Check file formatting.");
            return;
        }
        document.getElementById("upload-container").style.display = "none";
        document.getElementById("quiz-container").style.display = "block";
        startQuiz();
    }).catch(err => alert("Error: " + err.message));
}

function processPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const typedarray = new Uint8Array(e.target.result);
            pdfjsLib.getDocument(typedarray).promise.then(pdf => {
                const numPages = pdf.numPages;
                const pagePromises = [];
                for (let i = 1; i <= numPages; i++) {
                    pagePromises.push(pdf.getPage(i).then(page => {
                        const scale = 1.5;
                        const viewport = page.getViewport({ scale: scale });
                        const canvas = document.createElement("canvas");
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const ctx = canvas.getContext("2d");
                        return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(() => {
                            return Tesseract.recognize(canvas, 'eng').then(result => result.data.text);
                        });
                    }));
                }
                Promise.all(pagePromises).then(pageTexts => resolve(pageTexts.join("\n"))).catch(reject);
            }).catch(reject);
        };
        reader.readAsArrayBuffer(file);
    });
}

function processImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                Tesseract.recognize(img, 'eng').then(result => resolve(result.data.text)).catch(reject);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function parseQuestionsFromText(text) {
    const questions = [];
    const blocks = text.split(/Question\s*\d+:/i);
    blocks.forEach(block => {
        block = block.trim();
        if (!block) return;
        const parts = block.split(/a\)/i);
        if (parts.length < 2) return;
        const questionText = parts[0].trim();
        const optionsText = "a)" + parts.slice(1).join("a)");
        const optionRegex = /([a-e])\)\s*([^a-e]+?)(?=(?:[a-e]\)|Answer:|$))/gi;
        let match;
        const options = [];
        let correct = null;

        while ((match = optionRegex.exec(optionsText)) !== null) {
            options.push(match[2].trim());
        }
        const answerMatch = block.match(/Answer:\s*([a-e])/i);
        if (answerMatch) {
            correct = ['a', 'b', 'c', 'd', 'e'].indexOf(answerMatch[1].toLowerCase());
        }
        if (options.length >= 2) {
            questions.push({ question: questionText, options, correct });
        }
    });
    return questions;
}

function startQuiz() {
    currentQuestion = 0;
    score = 0;
    document.getElementById("score").style.display = "none";
    showQuestion();
}

function showQuestion() {
    if (currentQuestion >= quizData.length) {
        document.getElementById("quiz-container").innerHTML = `<h2>Quiz Over!</h2><p>Your Score: ${score} / ${quizData.length}</p>`;
        return;
    }

    const data = quizData[currentQuestion];
    document.getElementById("question").innerHTML = `<h3>Question ${currentQuestion + 1}:</h3><p>${data.question}</p>`;
    document.getElementById("options").innerHTML = "";

    data.options.forEach((option, index) => {
        const btn = document.createElement("button");
        btn.innerHTML = `<strong>${String.fromCharCode(97 + index)})</strong> ${option}`;
        btn.onclick = () => {
            if (data.correct === index) score++;
            currentQuestion++;
            showQuestion();
        };
        document.getElementById("options").appendChild(btn);
    });
}