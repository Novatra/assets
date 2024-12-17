const API_BASE = "https://qapi-xbw7.onrender.com/";
let subject = "", chapter = "", topic = "", questions = [], currentQuestionIndex = 0, timer = 0, timerInterval;
let questionProgress = [];
let isManualScroll = false;
let scrollTimeoutId = null;

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secondsRemaining = seconds % 60;
    let timeString = "";
    if (minutes > 0) {
        timeString += minutes + "m ";
    }
    if (secondsRemaining > 0) {
        timeString += secondsRemaining + "s";
    }
    return timeString;
}

function startTimer() {
    timer = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer++;
        $("#timer").text(formatTime(timer));
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function renderMathJax() {
    MathJax.typesetPromise().then(() => {
        console.log('MathJax rendering complete');
    }).catch((err) => {
        console.error('MathJax rendering failed:', err);
    });
}

function renderContent(html) {
    return html;
}

function fetchAndRenderSubjects() {
    $("#subject-container").show();
    $("#subjects").html("");
    ["maths", "physics", "chemistry"].forEach(sub => {
        $("#subjects").append(`
            <button class='subject' data-subject='${sub}'>
                ${sub.toUpperCase()}
            </button>
        `);
    });
}

function fetchChapters() {
    $.get(`${API_BASE}${subject}`, (data) => {
        $("#chapter-container").show();
        $("#chapters").html("");
        data.chapters.forEach(ch => {
            $("#chapters").append(`
                <button class='chapter' data-chapter='${ch}'>
                    ${ch.replace(/-/g, ' ')}
                </button>
            `);
        });
        $("#subject-container").hide();
    });
}

function fetchTopics() {
    $.get(`${API_BASE}${subject}/${chapter}`, (data) => {
        $("#topic-container").show();
        $("#topics").html("");
        data.topics.forEach(tp => {
            $("#topics").append(`
                <button class='topic' data-topic='${tp}'>
                    ${tp.replace(/-/g, ' ')}
                </button>
            `);
        });
        $("#chapter-container").hide();
    });
}

function initQuestionProgress() {
    questionProgress = questions.map((q, index) => ({
        index: index,
        answered: false,
        correct: null,
        type: q.type
    }));
    updateQuestionListUI();
}

function updateQuestionListUI() {
    const questionList = $(`
        <div id="question-list-container" style="position: sticky; top: 0; padding: 10px; background-color: #f0f0f0; z-index: 1; display: flex; overflow-x: auto; white-space: nowrap;">
            ${questionProgress.map(q => `
                <div class="question-list-item" data-index="${q.index}" style="flex-shrink: 0; width: 30%; text-align: center; padding: 5px 0; display: flex; justify-content: center; align-items: center;">
                    Q${q.index + 1} 
                    ${q.answered ? (q.correct ? '✅' : '❌') : ''}
                </div>
            `).join('')}
        </div>
    `);

    questionList.on('click', '.question-list-item', function() {
        const targetIndex = $(this).data('index');
        currentQuestionIndex = targetIndex;
        renderQuestion();
    });

    $("#question-list-container").remove();
    $(".app-container").prepend(questionList);
    
    const container = $("#question-list-container");
    container.on('scroll', function() {
        isManualScroll = true;
        clearTimeout(scrollTimeoutId);
        scrollTimeoutId = setTimeout(function() {
            isManualScroll = false;
        }, 500);
    });

    
    // Center the current question
    const currentQuestionItem = $(`.question-list-item[data-index="${currentQuestionIndex}"]`);
    const itemWidth = currentQuestionItem.outerWidth();
    const containerWidth = container.outerWidth();
    const itemLeft = currentQuestionItem.position().left;
    const newScrollLeft = itemLeft - (containerWidth - itemWidth) / 2;
    //container.scrollLeft(newScrollLeft);

    // Adjust scroll position on container scroll
    container.on('scroll', function() {
        const currentScrollLeft = container.scrollLeft();
        const currentQuestionItem = $(`.question-list-item[data-index="${currentQuestionIndex}"]`);
        const itemLeft = currentQuestionItem.position().left;
        const newScrollLeft = itemLeft - (containerWidth - itemWidth) / 2;
        if (Math.abs(currentScrollLeft - newScrollLeft) > 10) {
            //container.scrollLeft(newScrollLeft);
        }
    });

    // Add a timeout to ensure the container has finished rendering
    setTimeout(function() {
        //container.scrollLeft(newScrollLeft);
    }, 100);
}

function fetchQuestions() {
    $.get(`${API_BASE}${subject}/${chapter}/${topic}`, (data) => {
        questions = data.questions.reverse();
        currentQuestionIndex = 0;
        $("#total-questions").text(questions.length);
        $("#question-container").show();
        initQuestionProgress();
        renderQuestion();
        $("#topic-container").hide();
    });
}

function renderQuestion() {
    if (!questions.length) return;

    const currentQuestion = questions[currentQuestionIndex];
    const q = currentQuestion.question;
    
    // Update question number and paper title
    $("#current-question").text(currentQuestionIndex + 1);
    $("#paper-title").text(currentQuestion.paperTitle || "");
    
    $("#question").html(renderContent(q.content));
    $("#check-answer").prop("disabled", false); // Enable the check answer button
    $(".option").removeClass("disabled"); // Remove the disabled class from the options
    $("#integer-input").prop("disabled", false); // Enable the integer input field

    // Render based on question type
    if (currentQuestion.type === "mcq") {
        const options = q.options.map(opt => {
            const renderedContent = renderContent(opt.content);
            return `
                <button class='option' data-identifier='${opt.identifier}'>
                    ${renderedContent}
                </button>
            `;
        }).join("");
        $("#options").html(options);
        $("#integer-input").hide();
        $("#options").show();
    } else if (currentQuestion.type === "integer") {
        $("#options").hide();
        $("#integer-input")
            .show()
            .val("")  // Clear previous input
            .attr('type', 'number');
    }

    // Reset previous states
    $(".option").removeClass("selected correct incorrect");
    $("#explanation").html("");
    $("#check-answer").show();
    
    // Manage navigation buttons
    $("#prev-question").prop('disabled', currentQuestionIndex === 0);
    $("#next-question").prop('disabled', false);

    // Highlight current question in list and scroll to it
    $(".question-list-item").removeClass("active");
    const currentQuestionItem = $(`.question-list-item[data-index="${currentQuestionIndex}"]`);
    currentQuestionItem.addClass("active");

    const container = $("#question-list-container");
    if (!isManualScroll) {
        const itemLeft = currentQuestionItem.offset().left - container.offset().left + container.scrollLeft();
        const itemWidth = currentQuestionItem.outerWidth();
        const containerWidth = container.outerWidth();
        const newScrollLeft = itemLeft - (containerWidth - itemWidth) / 2;
        container.stop().animate({ scrollLeft: newScrollLeft }, 500); // Scroll to the current question with animation
    }
    
    startTimer();
    renderMathJax();
}

// Event Listeners
$(document).on("click", ".subject", function() {
    subject = $(this).data("subject");
    updateBreadcrumb();
    fetchChapters();
    hideQuestionContainer();
});

$(document).on("click", ".chapter", function() {
    chapter = $(this).data("chapter");
    updateBreadcrumb();
    fetchTopics();
    hideQuestionContainer();
});

$(document).on("click", ".topic", function() {
    topic = $(this).data("topic");
    updateBreadcrumb();
    fetchQuestions();
    hideQuestionContainer();
});

$(document).on("click", ".option", function() {
    if (!$(this).hasClass("disabled")) {
        $(".option").removeClass("selected");
        $(this).addClass("selected");
        $("#check-answer").show();
    }
});

$("#check-answer").click(function () {
    stopTimer();
    $(this).prop("disabled", true); // Disable the check answer button
    $(".option").addClass("disabled"); // Add a disabled class to the options
    $("#integer-input").prop("disabled", true); // Disable the integer input field

    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    
    // Add audio elements for correct and wrong answers
    const correctSound = new Audio('correct.mp3');
    const wrongSound = new Audio('wrong.mp3');

    if (currentQuestion.type === "mcq") {
        const selected = $(".option.selected").data("identifier");
        const correctOptions = currentQuestion.question.correct_options;
        
        $(".option").each(function () {
            const optIdentifier = $(this).data("identifier");
            if (correctOptions.includes(optIdentifier)) {
                $(this).addClass("correct");
            }
        });

        isCorrect = correctOptions.includes(selected);
        if (isCorrect) {
            correctSound.play(); // Play correct sound
            $(".option.selected").addClass("correct");
            $("#explanation").html(`
                <div class="success">
                    <strong>Correct!</strong><br>
                    ${renderContent(currentQuestion.question.explanation).replace(/cdn.examgoal.net/g, "lol")}
                </div>
            `);
        } else {
            wrongSound.play(); // Play wrong sound
            $(".option.selected").addClass("incorrect");
            $("#explanation").html(`
                <div class="error">
                    <strong>Incorrect!</strong><br>
                    ${renderContent(currentQuestion.question.explanation).replace(/cdn.examgoal.net/g, "lol")}
                </div>
            `);
        }
    } else if (currentQuestion.type === "integer") {
        const userAnswer = $("#integer-input").val();
        const correctAnswer = currentQuestion.question.answer;
        
        isCorrect = userAnswer === correctAnswer.toString();
        
        if (isCorrect) {
            correctSound.play(); // Play correct sound
            $("#explanation").html(`
                <div class="success">
                    <strong>Correct!</strong><br>
                    ${renderContent(currentQuestion.question.explanation).replace(/cdn.examgoal.net/g, "lol")}
                </div>
            `);
        } else {
            wrongSound.play(); // Play wrong sound
            $("#explanation").html(`
                <div class="error">
                    <strong>Incorrect!</strong> The correct answer is ${correctAnswer}<br>
                    ${renderContent(currentQuestion.question.explanation).replace(/cdn.examgoal.net/g, "lol")}
                </div>
            `);
        }
    }

    // Update question progress
    questionProgress[currentQuestionIndex].answered = true;
    questionProgress[currentQuestionIndex].correct = isCorrect;
    updateQuestionListUI();

    // Always enable next button after checking
    $("#next-question").prop('disabled', false);
    
    // Hide check answer button after first use
    $(this).hide();
    
    renderMathJax();
});


$("#prev-question").click(function() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
});

$("#next-question").click(function() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
        stopTimer();
        startTimer();
    }
});

// Back navigation buttons
$("#back-to-subjects").click(function() {
    $("#chapter-container").hide();
    $("#subject-container").show();
});

$("#back-to-chapters").click(function() {
    $("#topic-container").hide();
    $("#chapter-container").show();
});

function updateBreadcrumb() {
    $("#breadcrumb-subject").text(subject).toggle(Boolean(subject));
    $("#breadcrumb-chapter").text(chapter.replace(/-/g, ' ')).toggle(Boolean(chapter));
    $("#breadcrumb-topic").text(topic.replace(/-/g, ' ')).toggle(Boolean(topic));
}

function hideQuestionContainer() {
    $("#question-container").hide();
}

// Breadcrumb navigation
$("#breadcrumb-subject").click(function () {
    chapter = "";
    topic = "";
    updateBreadcrumb();
    hideQuestionContainer();
    $("#chapter-container").hide();
    $("#topic-container").hide();
    $("#subject-container").show();
});

$("#breadcrumb-chapter").click(function () {
    topic = "";
    updateBreadcrumb();
    hideQuestionContainer();
    $("#topic-container").hide();
    $("#chapter-container").show();
});

$("#breadcrumb-topic").click(function () {
    updateBreadcrumb();
    hideQuestionContainer();
    $("#question-container").show();
});

$(document).ready(() => {
    fetchAndRenderSubjects();
});

function hideQuestionContainer() {
    $("#question-container").hide();
    $("#question-list-container").remove(); // Add this line
}
