let GIT_TOKEN = localStorage.getItem("GIT_TOKEN");
let GIST_ID = localStorage.getItem("GIST_ID");


let activeModal = null; // Track the currently active modal

function toggleModal(id) {
    const modal = document.getElementById(id);

    // If the clicked modal is already open, close it
    if (activeModal === modal) {
        modal.style.display = "none";
        activeModal = null;
    } else {
        // Close any previously opened modal
        if (activeModal) {
            activeModal.style.display = "none";
        }
        // Show the new modal
        modal.style.display = "block";
        activeModal = modal;
    }
}

const FILENAME = "activity-data.json";

let currentReminderTaskId = null;
let selectedReminderType = null;


window.onload = async function() {
    tasks = [];
    checkboxStates = {};
    const today = new Date();
    selectedYear = today.getFullYear();
    selectedMonth = today.getMonth();

    await loadFromGist(); // Automatically load data on startup

    populateMonthDropdown();
    generateTable();

    document.getElementById('newTask').addEventListener('keypress', e => {
        if (e.key === 'Enter') addNewTask();
    });

    flatpickr("#timelineRange", { mode: "range", dateFormat: "Y-m-d", time_24hr: true });
    flatpickr("#pauseRange", { mode: "range", dateFormat: "Y-m-d" });

    // Auto-open settings modal if credentials are missing
    if (!localStorage.getItem("GIT_TOKEN") || !localStorage.getItem("GIST_ID")) {
        toggleSettings();
    }
};

function saveSettings() {
    const gitToken = document.getElementById('gitTokenInput').value.trim();
    const gistId = document.getElementById('gistIdInput').value.trim();

    if (gitToken && gistId) {
        localStorage.setItem("GIT_TOKEN", gitToken);
        localStorage.setItem("GIST_ID", gistId);
        alert("Credentials saved!");
        location.reload(); // Reload page after saving settings (removed hideModal)
    } else {
        alert("Please enter both GitHub Token and Gist ID.");
    }
}

function logout() {
    localStorage.removeItem("GIT_TOKEN");
    localStorage.removeItem("GIST_ID");
    alert("Logged out successfully!");
    location.reload(); // Reload page after logout (removed hideModal)
}


async function saveToGist() {
    const data = JSON.stringify({
        tasks: tasks,
        checkboxStates: checkboxStates,
        selectedYear: selectedYear,
        selectedMonth: selectedMonth
    });

    try {
        const response = await fetch(`https://api.github.com/gists/${localStorage.getItem("GIST_ID")}`, {
            method: "PATCH",
            headers: {
                "Authorization": `token ${localStorage.getItem("GIT_TOKEN")}`,        
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                files: {
                    [FILENAME]: { content: data }
                }
            })
        });

        if (response.ok) {
            console.log("Data successfully saved to GitHub Gist");
        } else {
            console.error("Error saving data to Gist", await response.json());
        }
    } catch (error) {
        console.error("Failed to save to GitHub Gist", error);
    }
}

async function loadFromGist() {
    try {
        const response = await fetch(`https://api.github.com/gists/${localStorage.getItem("GIST_ID")}`);
        if (response.ok) {
            const gistData = await response.json();
            const content = gistData.files[FILENAME]?.content;
            if (content) {
                const data = JSON.parse(content);
                
                // Permanent deletion migration
                tasks = (data.tasks || []).filter(task => 
                    task.deletionMonth === undefined || // Keep if never deleted
                    new Date().getMonth() < task.deletionMonth // Keep if not past deletion month
                );
                
                // Remove deletionMonth property from remaining tasks
                tasks = tasks.map(task => {
                    const { deletionMonth, ...cleanTask } = task;
                    return cleanTask;
                });

                checkboxStates = data.checkboxStates || {};
                // Remove checkbox states for deleted tasks
                Object.keys(checkboxStates).forEach(taskId => {
                    if (!tasks.some(t => t.id == taskId)) {
                        delete checkboxStates[taskId];
                    }
                });

                selectedYear = data.selectedYear || new Date().getFullYear();
                selectedMonth = data.selectedMonth || new Date().getMonth();
                
                // Immediately save cleaned data back to Gist
                await saveToGist();
                console.log("Data cleaned and migrated successfully");
            }
        }
    } catch (error) {
        console.error("Failed to load from GitHub Gist", error);
    }
}

function saveTasks() {
    saveToGist(); // Automatically save to GitHub Gist when tasks are updated
}

function saveCheckboxStates() {
    saveToGist(); // Automatically save checkboxes to GitHub Gist
}

// Add these new functions
function exportData() {
    const data = {
        tasks: tasks,
        checkboxStates: checkboxStates,
        selectedYear: selectedYear,
        selectedMonth: selectedMonth
    };
    
    const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                tasks = data.tasks || [];
                checkboxStates = data.checkboxStates || {};
                selectedYear = data.selectedYear || new Date().getFullYear();
                selectedMonth = data.selectedMonth || new Date().getMonth();
                
                populateMonthDropdown();
                generateTable();
                alert('Data imported successfully!');
            } catch (error) {
                alert('Error importing data: Invalid file format');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function generateTable() {
    const daysInMonth = generateHeaders();
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    tasks.forEach(task => {
        if (task.deletionMonth !== undefined && task.deletionMonth <= selectedMonth) {
            return; // Skip deleted tasks in current and future months
        }

        const rowHTML = createTaskRow(task, daysInMonth);
        tableBody.innerHTML += rowHTML;
    });
}


function createTaskRow(task, daysInMonth) {
    // Check if current month is before task creation
    const [year, month, day] = task.createdAt.split('-');
    const taskCreationDate = new Date(year, month - 1, day);
    taskCreationDate.setHours(0, 0, 0, 0);
    const currentMonthDate = new Date(selectedYear, selectedMonth, 1);
    
    if (task.deletionYear !== undefined && task.deletionMonth !== undefined) {
        if (
            selectedYear > task.deletionYear ||
            (selectedYear === task.deletionYear && selectedMonth >= task.deletionMonth)
        ) {
            return '';
        }
    }
    // Skip rendering if current month is before task creation
    if (currentMonthDate < new Date(taskCreationDate.getFullYear(), taskCreationDate.getMonth(), 1)) {
        return '';
    }

    // Check if current month intersects with any timeline
    const currentMonthStart = new Date(selectedYear, selectedMonth, 1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const currentMonthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    currentMonthEnd.setHours(0, 0, 0, 0);
    const hasActiveTimeline = task.timelines?.some(t => {
        const timelineStart = new Date(t.start);
        timelineStart.setHours(0, 0, 0, 0);
        const timelineEnd = new Date(t.end);
        timelineEnd.setHours(0, 0, 0, 0);
        return !(currentMonthStart > timelineEnd || currentMonthEnd < timelineStart);
    });

    // Skip rendering if no active timeline exists for this month
    if (task.timelines?.length && !hasActiveTimeline) {
        return '';
    }

    let rowHTML = `<tr><td class="fixed-column activity-name-container">
        <span class="activity-name">${task.name}</span>
        <div class="activity-actions">
            <span class="edit-btn" title="Edit Task Name" onclick="editTask(${task.id})">✏️</span>
            <span class="pause-btn" title="Pause Task" onclick="showPauseModal(${task.id})">⏸️</span>
            <span class="timeline-btn" title="Set Timeline" onclick="showTimelineModal(${task.id})">📆</span>
            <span class="reminder-btn" title="Set Reminder" onclick="showReminderModal(${task.id})">⏰</span>
            ${task.endDate ? 
                `<span class="unend-btn" title="Unend Task" onclick="unendTask(${task.id})">🚀</span>` : 
                `<span class="end-btn" title="End Task" onclick="endTask(${task.id})">🏁</span>`
            }
            <span class="delete-btn" title="Delete Task" onclick="deleteTask(${task.id})">⛔</span>
        </div>
    </td>`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(selectedYear, selectedMonth, day);
        currentDate.setHours(0, 0, 0, 0);
        const dateKey = getDateKey(currentDate);
        const currentDayOfWeek = currentDate.getDay();
        const currentDayOfMonth = currentDate.getDate();

        // 1. Check creation date
        if (currentDate < taskCreationDate) {
            rowHTML += '<td class="active-pause"></td>';
            continue;
        }

        // 2. Check timelines
        const isInAnyTimeline = task.timelines?.some(t => {
            const timelineStart = new Date(t.start);
            timelineStart.setHours(0, 0, 0, 0);
            const timelineEnd = new Date(t.end);
            timelineEnd.setHours(0, 0, 0, 0);
            return currentDate >= timelineStart && currentDate <= timelineEnd;
        });

        if (task.timelines?.length && !isInAnyTimeline) {
            rowHTML += '<td class="active-pause"></td>';
            continue;
        }

        // 3. Check reminder types
        let isPausedByReminder = false;
        if (task.reminderType === 'frequent' && task.frequentStartDate) {
            const startDate = new Date(task.frequentStartDate);
            startDate.setHours(0, 0, 0, 0);
            
            // Calculate days since start
            const timeDiff = currentDate - startDate;
            const daysSinceStart = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            
            if (daysSinceStart < 0) {
                // Before start date - always paused
                isPausedByReminder = true;
            } else {
                // Calculate which cycle we're in
                const cycleNumber = Math.floor(daysSinceStart / task.frequentInterval);
                const daysInCurrentCycle = daysSinceStart % task.frequentInterval;
                
                // Only first day of each cycle is active
                if (daysInCurrentCycle !== 0) {
                    isPausedByReminder = true;
                }
            }
        }
        else if (task.reminderType === 'weekly') {
            if (!task.frequencyDays?.includes(currentDayOfWeek)) {
                isPausedByReminder = true;
            }
        }
        else if (task.reminderType === 'monthly') {
            if (!task.monthlyDays?.includes(currentDayOfMonth)) {
                isPausedByReminder = true;
            }
        }

        if (isPausedByReminder && !checkboxStates[task.id]?.[dateKey]) {
            rowHTML += '<td class="active-pause"></td>';
            continue;
        }

        // 4. Check pause periods and end date
        const isPaused = task.pauses?.some(p => {
            const start = new Date(p.start + "T00:00");
            const end = new Date(p.end + "T00:00");
            return currentDate >= start && currentDate <= end;
        });

        const isEnded = task.endDate && currentDate >= new Date(task.endDate);

        if (isPaused || isEnded) {
            rowHTML += '<td class="active-pause"></td>';
            continue;
        }

        // 5. Check future dates
        const isFuture = currentDate > today;

        let status = checkboxStates[task.id]?.[dateKey] || '';
        rowHTML += `<td class="${status}">
            ${!isFuture ? `<div class="status-options">
                <div class="status-option completed" title="Completed" onclick="updateStatus(${task.id}, '${dateKey}', 'completed')"></div>
                <div class="status-option partial" title="Partially Done" onclick="updateStatus(${task.id}, '${dateKey}', 'partial')"></div>
                <div class="status-option missed" title="Missed" onclick="updateStatus(${task.id}, '${dateKey}', 'missed')"></div>
            </div>` : ''}
        </td>`;
    } 
    return rowHTML + '</tr>';
}

let currentFrequencyTaskId = null;
let selectedDays = new Set();
initializeFrequentDays();

function showFrequencyModal(taskId) {
    currentFrequencyTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    selectedDays = new Set(task.frequencyDays || []);
    updateDayButtons();
    showModal('frequencyModal');
}

function toggleDay(button) {
    const day = parseInt(button.dataset.day);
    if (selectedDays.has(day)) {
        selectedDays.delete(day);
        button.classList.remove('selected');
    } else {
        selectedDays.add(day);
        button.classList.add('selected');
    }
}

function updateDayButtons() {
    document.querySelectorAll('.day-btn').forEach(button => {
        const day = parseInt(button.dataset.day);
        button.classList.toggle('selected', selectedDays.has(day));
    });
}

function saveFrequency() {
    const task = tasks.find(t => t.id === currentFrequencyTaskId);
    task.frequencyDays = Array.from(selectedDays).sort();
    saveTasks();
    generateTable();
    hideModal('frequencyModal');
}

function deleteFrequency() {
    const task = tasks.find(t => t.id === currentFrequencyTaskId);
    delete task.frequencyDays;
    saveTasks();
    generateTable();
    hideModal('frequencyModal');
}

function showReminderModal(taskId) {
    currentReminderTaskId = taskId;
    toggleModal('reminderModal');
    const task = tasks.find(t => t.id === taskId);
    
    // Reset selections for new task
    selectedReminderType = task.reminderType || null;
    selectedDays = new Set(task.frequencyDays || []);
    selectedMonthlyDays = new Set(task.monthlyDays || []);
    
    // Initialize frequent days
    document.getElementById('frequentInterval').value = task.frequentInterval || 1;
    document.getElementById('frequentStartDate').value = task.frequentStartDate || '';
    
    showModal('reminderModal');
    updateReminderUI();
}

function selectReminderType(type) {
    selectedReminderType = type;
    updateReminderUI();
}

function updateReminderUI() {
    // Show all options if no reminder type is selected
    document.querySelectorAll('.reminder-option').forEach(option => {
        option.style.display = !selectedReminderType || option.classList.contains(selectedReminderType) ? 'block' : 'none';
    });

    // Update selected state
    document.querySelectorAll('.reminder-option').forEach(option => {
        option.classList.toggle('selected', option.classList.contains(selectedReminderType));
    });

    // Show selected content
    document.querySelectorAll('.reminder-content').forEach(el => {
        el.classList.remove('active');
    });

    if(selectedReminderType === 'weekly') {
        updateDayButtons();
        document.getElementById('weeklyContent').classList.add('active');
    } else if(selectedReminderType === 'monthly') {
        initializeMonthlyDays();
        document.getElementById('monthlyContent').classList.add('active');
    } else if(selectedReminderType === 'frequent') {
        document.getElementById('frequentContent').classList.add('active');
    }
}

// Monthly Reminder Functions
let selectedMonthlyDays = new Set();

function initializeMonthlyDays() {
    const grid = document.querySelector('.monthly-days-grid');
    grid.innerHTML = '';
    
    for(let i = 1; i <= 31; i++) {
        const day = document.createElement('div');
        day.className = `monthly-day ${selectedMonthlyDays.has(i) ? 'selected' : ''}`;
        day.textContent = i;
        day.onclick = () => toggleMonthlyDay(i, day);
        grid.appendChild(day);
    }
}

function toggleMonthlyDay(day, element) {
    if(selectedMonthlyDays.has(day)) {
        selectedMonthlyDays.delete(day);
        element.classList.remove('selected');
    } else {
        selectedMonthlyDays.add(day);
        element.classList.add('selected');
    }
}

// Frequent Days Functions
function initializeFrequentDays() {
    const select = document.getElementById('frequentInterval');
    select.innerHTML = '';
    for(let i = 2; i <= 31; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        select.appendChild(option);
    }
    
    // Set today's date as default start date
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    document.getElementById('frequentStartDate').value = formattedDate;
    document.getElementById('frequentStartDate').min = formattedDate;
}

function saveReminderSettings() {
    const task = tasks.find(t => t.id === currentReminderTaskId);
    
    if(!selectedReminderType) {
        deleteReminderSettings();
        return;
    }

    // Clear all reminder settings first
    delete task.reminderType;
    delete task.frequencyDays;
    delete task.monthlyDays;
    delete task.frequentInterval;
    delete task.frequentStartDate;

    // Set new reminder settings
    if(selectedReminderType === 'weekly') {
        task.reminderType = 'weekly';
        task.frequencyDays = Array.from(selectedDays);
    } 
    else if(selectedReminderType === 'monthly') {
        task.reminderType = 'monthly';
        task.monthlyDays = Array.from(selectedMonthlyDays);
    }
    else if(selectedReminderType === 'frequent') {
        task.reminderType = 'frequent';
        task.frequentInterval = parseInt(document.getElementById('frequentInterval').value);
        task.frequentStartDate = document.getElementById('frequentStartDate').value;
    }
    
    saveTasks();
    generateTable();
    hideModal('reminderModal');
}

function deleteReminderSettings() {
    const task = tasks.find(t => t.id === currentReminderTaskId);
    delete task.reminderType;
    delete task.frequencyDays;
    delete task.monthlyDays;
    delete task.frequentInterval;
    delete task.frequentStartDate;
    
    // Reset UI state
    selectedReminderType = null;
    selectedDays = new Set();
    selectedMonthlyDays = new Set();
    document.getElementById('frequentInterval').value = 1;
    document.getElementById('frequentStartDate').value = '';
    
    saveTasks();
    generateTable();
    hideModal('reminderModal');
}

let currentTimelineTaskId = null;

function showTimelineModal(taskId) {
    currentTimelineTaskId = taskId;
    toggleModal('timelineModal');
    const task = tasks.find(t => t.id === taskId);
    const timelineInput = document.getElementById('timelineRange');
    timelineInput._flatpickr.clear();
    updateCurrentTimelinesDisplay(task);
    showModal('timelineModal');
}

function updateCurrentTimelinesDisplay(task) {
    const container = document.getElementById('currentTimelines');
    container.innerHTML = task.timelines?.length 
        ? `<h4>Current Timelines:</h4>${task.timelines.map((timeline, index) => `
            <div>
                ${formatDate(timeline.start)} - ${formatDate(timeline.end)}
                <button onclick="removeTimeline(${index})">Remove</button>
            </div>
        `).join('')}`
        : '<p>No active timelines</p>';
}

function removeTimeline(index) {
    const task = tasks.find(t => t.id === currentTimelineTaskId);
    task.timelines.splice(index, 1);
    saveTasks();
    updateCurrentTimelinesDisplay(task);
    generateTable();
}

// In saveTimelinePeriod (align with pause date handling)
function saveTimelinePeriod() {
    const task = tasks.find(t => t.id === currentTimelineTaskId);
    const selectedDates = document.getElementById('timelineRange')._flatpickr.selectedDates;
    
    if (selectedDates.length !== 2) return alert("Select start and end dates");
    
    // Convert to local dates at midnight (same as pause function)
    const start = new Date(selectedDates[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDates[1]);
    end.setHours(0, 0, 0, 0);
    
    if (start > end) return alert('End date must be after start date!');
    
    // Store dates in YYYY-MM-DD format (local time)
    task.timelines = task.timelines || [];
    task.timelines.push({
        start: formatLocalDate(start),
        end: formatLocalDate(end)
    });
    
    saveTasks();
    generateTable();
    hideModal('timelineModal');
}

// Add this helper function (same as pause uses)
function formatLocalDate(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function formatDateToISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}


function updateStatus(taskId, dateKey, status) {
    checkboxStates[taskId] = checkboxStates[taskId] || {};
    checkboxStates[taskId][dateKey] = status;
    saveCheckboxStates();
    generateTable();
}

function isPaused(date, task) {
    return task.pauses?.some(p => {
        const start = new Date(p.start + 'T00:00:00');
        const end = new Date(p.end + 'T00:00:00');
        return date >= start && date <= end;
    });
}

function addNewTask() {
    const input = document.getElementById('newTask');
    const taskName = input.value.trim();
    if (!taskName) return;

    // Use the selected month/year as the reference.
    const currentYear = selectedYear;
    const currentMonth = selectedMonth;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.push({
        id: Date.now(),
        name: taskName,
        createdAt: formatDateToISO(today), // Store as ISO string for consistency
        pauses: [],
        endDate: null
    });
    
    saveTasks();
    input.value = '';
    generateTable();
}


function editTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    const newName = prompt('Edit habit name:', task.name);
    if (newName?.trim()) {
        task.name = newName.trim();
        saveTasks();
        generateTable();
    }
}

function deleteTask(taskId) {
    const confirmation = confirm("This action is irreversible. Are you sure you want to proceed?");
    if (!confirmation) return;

    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    tasks.splice(taskIndex, 1);
    delete checkboxStates[taskId];
    
    saveTasks();
    generateTable();
}

function showPauseModal(taskId) {
    currentPauseTaskId = taskId;
    toggleModal('pauseModal')
    const task = tasks.find(t => t.id === taskId);
    const pauseInput = document.getElementById('pauseRange');
    pauseInput._flatpickr.clear();
    updateCurrentPausesDisplay(task);
    showModal('pauseModal');
}


function updateCurrentPausesDisplay(task) {
    const container = document.getElementById('currentPauses');
    container.innerHTML = task.pauses?.length 
        ? `<h4>Current Pauses:</h4>${task.pauses.map((pause, index) => `
            <div>
                ${formatDate(pause.start)} - ${formatDate(pause.end)}
                <button onclick="removePause(${index})">Remove</button>
            </div>
        `).join('')}`
        : '<p>No active pauses</p>';
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00'); // Force midnight local time
    return date.toLocaleDateString('en-GB');
}

function removePause(index) {
    const task = tasks.find(t => t.id === currentPauseTaskId);
    task.pauses.splice(index, 1);
    saveTasks();
    updateCurrentPausesDisplay(task);
    generateTable();
}

function savePausePeriod() {
    const task = tasks.find(t => t.id === currentPauseTaskId);
    const selectedDates = document.getElementById('pauseRange')._flatpickr.selectedDates;
    
    if (selectedDates.length !== 2) {
        alert("Please select both a start and an end date.");
        return;
    }
    
    // Fix timezone issues by manually constructing the date string
    const start = formatDateToISO(selectedDates[0]);
    const end = formatDateToISO(selectedDates[1]);
    
    if (new Date(start) > new Date(end)) {
        alert('End date must be after start date!');
        return;
    }
    
    task.pauses = task.pauses || [];
    task.pauses.push({ start, end });
    saveTasks();
    generateTable();
    hideModal('pauseModal');
}


function generateReport() {
    const pdf = new jspdf.jsPDF();
    addAnalysisPage(pdf);
    pdf.save(`Report-${selectedMonth+1}-${selectedYear}.pdf`);
}

function addAnalysisPage(pdf) {
    const visibleTasks = tasks; // Now matches UI exactly

    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = 20;

    // Add title
    pdf.setFontSize(14);
    pdf.text(`Activity Progress Report - ${new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`, 20, yPos);
    yPos += 15;

    // Reset font size for content
    pdf.setFontSize(11);

    visibleTasks.forEach((task, index) => {

        if(yPos > 270) {  // Check if we need a new page
            pdf.addPage();
            yPos = 20;
        }

        // Task number and name
        pdf.text(`${index + 1}) ${task.name}`, 20, yPos);
        yPos += 7;

        const analysis = getTaskAnalysis(task);
        
        // Status counts with colors and separator
        // Completed (green)
        pdf.setTextColor(0, 128, 0); // Green
        pdf.text(`completed = ${analysis.completed}`, 25, yPos);
        
        // Separator
        pdf.setTextColor(0, 0, 0); // Black
        pdf.text('||', pdf.getTextWidth(`completed = ${analysis.completed}`) + 30, yPos);
        
        // Partial (yellow/orange for better visibility)
        pdf.setTextColor(204, 153, 0); // Dark yellow
        const partialX = pdf.getTextWidth(`completed = ${analysis.completed}`) + 40;
        pdf.text(`partial = ${analysis.partial}`, partialX, yPos);
        
        // Separator
        pdf.setTextColor(0, 0, 0); // Black
        pdf.text('||', partialX + pdf.getTextWidth(`partial = ${analysis.partial}`) + 5, yPos);
        
        // Missed (red)
        pdf.setTextColor(255, 0, 0); // Red
        const missedX = partialX + pdf.getTextWidth(`partial = ${analysis.partial}`) + 15;
        pdf.text(`missed = ${analysis.missed}`, missedX, yPos);
        
        // Reset color for message
        pdf.setTextColor(0, 0, 0);
        yPos += 7;
        
        // Message
        pdf.text(analysis.message, 25, yPos);
        yPos += 12;  // Space before next task
    });
}

function getTaskAnalysis(task) {
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);
    let completed = 0, partial = 0, missed = 0;

    for(let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
        const dateKey = getDateKey(day);
        const status = checkboxStates[task.id]?.[dateKey];

        if(isPaused(day, task)) continue;
        if(day > new Date()) continue;

        if(status === 'completed') completed++;
        else if(status === 'partial') partial++;
        else if(status === 'missed') missed++;
    }

    const total = completed + partial + missed;
    let message = '';

    if(total === 0) {
        return {
            completed: 0,
            partial: 0,
            missed: 0,
            message: 'No activity days'
        };
    }

    if(completed === total) message = 'Wow! Excellent';
    else if(completed > (missed + partial)) message = 'Great, you are almost there. Keep it up!';
    else if(completed === (missed + partial)) message = 'Good! Maintain consistency';
    else if(completed === 0) message = 'Try prioritizing this task';
    else message = 'You need more motivation. Try harder!';

    return {
        completed,
        partial,
        missed,
        message
    };
}

// Update getDateKey to use local dates
function getDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function generateHeaders() {
    const headerRow = document.getElementById('tableHeader');
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let headerHTML = '<tr><th class="fixed-column">--YOUR ACTIVITIES--</th>';
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedYear, selectedMonth, day);
        headerHTML += `<th>${day}<br>${date.toLocaleDateString('en-US', { weekday: 'short' })}</th>`;
    }
    headerRow.innerHTML = headerHTML + '</tr>';
    return daysInMonth;
}

function changeMonth() {
    const [year, month] = document.getElementById('monthSelect').value.split('-');
    selectedYear = parseInt(year);
    selectedMonth = parseInt(month);
    generateTable();
}
function endTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    task.endDate = new Date(today);
    task.endDate.setDate(today.getDate() + 1); // Task ends from the next day
    // Calculate deletion month (next month)
    const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    task.deletionMonth = nextMonthDate.getMonth();
    task.deletionYear = nextMonthDate.getFullYear();

    saveTasks();
    generateTable();
}

function unendTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (task.endDate) {
        const endDate = new Date(task.endDate);
        endDate.setHours(0, 0, 0, 0);
        
        // Add pause for days between endDate+1 and today-1
        if (endDate < today) {
            const pauseStart = new Date(endDate);
            pauseStart.setDate(pauseStart.getDate() + 1);
            
            const pauseEnd = new Date(today);
            pauseEnd.setDate(pauseEnd.getDate() - 1);

            if (pauseStart <= pauseEnd) {
                task.pauses = task.pauses || [];
                task.pauses.push({
                    start: formatDateToISO(pauseStart),
                    end: formatDateToISO(pauseEnd)
                });
            }
        }
    }

    // Clear deletion and end dates
    delete task.deletionMonth;
    delete task.deletionYear;
    task.endDate = null;

    saveTasks();
    generateTable();
}

function showModal(id) { document.getElementById(id).style.display = 'block'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }
function populateMonthDropdown() {
    const select = document.getElementById('monthSelect');
    select.innerHTML = '';

    // Find the earliest task creation date
    if (tasks.length === 0) return; // If no tasks, do nothing
    const firstTaskDate = new Date(Math.min(...tasks.map(t => new Date(t.createdAt))));
    let startYear = firstTaskDate.getFullYear();
    let startMonth = firstTaskDate.getMonth(); // 0-indexed

    const today = new Date();
    const endYear = today.getFullYear() + 5; // Limit to 5 years ahead

    for (let year = startYear; year <= endYear; year++) {
        for (let month = 0; month < 12; month++) {
            if (year === startYear && month < startMonth) continue; // Skip months before first task

            const option = document.createElement('option');
            const date = new Date(year, month);
            option.value = `${year}-${month}`;
            option.textContent = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            if (year === selectedYear && month === selectedMonth) {
                option.selected = true;
            }
            select.appendChild(option);
        }
    }
}

function toggleSettings() {
    // Show the settings modal
    document.getElementById('settingsModal').style.display = 'block';
    toggleModal('settingsModal');

    // Check if credentials are stored
    const storedToken = localStorage.getItem("GIT_TOKEN");
    const storedGistId = localStorage.getItem("GIST_ID");

    if (storedToken && storedGistId) {
        // Hide input fields and show Logout button
        document.getElementById('settingsInputs').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'block';
    } else {
        // Show input fields and hide Logout button
        document.getElementById('settingsInputs').style.display = 'block';
        document.getElementById('logoutButton').style.display = 'none';
    }
}

function saveSettings() {
    const gitToken = document.getElementById('gitTokenInput').value.trim();
    const gistId = document.getElementById('gistIdInput').value.trim();

    if (gitToken && gistId) {
        localStorage.setItem("GIT_TOKEN", gitToken);
        localStorage.setItem("GIST_ID", gistId);
        alert("Credentials saved!");
        setTimeout(() => window.location.reload(), 500); // Reload after 0.5s
    } else {
        alert("Please enter both GitHub Token and Gist ID.");
    }
}

function logout() {
    localStorage.removeItem("GIT_TOKEN");
    localStorage.removeItem("GIST_ID");
    alert("Logged out successfully!");
    setTimeout(() => window.location.reload(), 500); // Reload after 0.5s
}
z
