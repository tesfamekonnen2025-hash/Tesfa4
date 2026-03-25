// Firebase Configuration - Replace with your config
const firebaseConfig = {
    apiKey: "AIzaSyDemoKeyReplaceWithYourFirebaseApiKey",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let tasks = [];
let users = [];
let currentView = 'manager';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
});

// Authentication state listener
auth.onAuthStateChanged(function(user) {
    if (user) {
        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified
        };
        loadUserProfile();
        showApp();
    } else {
        currentUser = null;
        showAuth();
    }
});

// Check authentication
function checkAuth() {
    const user = auth.currentUser;
    if (user) {
        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified
        };
        loadUserProfile();
        showApp();
    } else {
        showAuth();
    }
}

// Load user profile from Firestore
async function loadUserProfile() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists) {
            currentUser = { ...currentUser, ...doc.data() };
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// UI Functions
function showAuth() {
    document.getElementById('authPage').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp() {
    document.getElementById('authPage').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;
    switchView(currentUser.role || 'worker');
    loadTasks();
    loadUsers();
}

function showTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (tab === 'login') {
        loginTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-l-lg bg-blue-600 text-white';
        registerTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-r-lg bg-gray-200 text-gray-700';
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        registerTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-r-lg bg-green-600 text-white';
        loginTab.className = 'flex-1 py-2 px-4 text-center font-medium rounded-l-lg bg-gray-200 text-gray-700';
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

// Authentication Functions
async function register() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;
    
    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update display name
        await user.updateProfile({ displayName: name });
        
        // Save user profile to Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });
        
        showMessage('Account created successfully!', 'success');
        
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showMessage('Login successful!', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

function logout() {
    auth.signOut();
}

// View switching
function switchView(view) {
    currentView = view;
    document.getElementById('currentView').textContent = view === 'manager' ? 'Manager View' : 'Worker View';
    
    if (view === 'manager') {
        document.getElementById('managerDashboard').classList.remove('hidden');
        document.getElementById('workerDashboard').classList.add('hidden');
    } else {
        document.getElementById('managerDashboard').classList.add('hidden');
        document.getElementById('workerDashboard').classList.remove('hidden');
    }
    
    updateDashboard();
    hideViewMenu();
}

function toggleViewMenu() {
    const menu = document.getElementById('viewMenu');
    menu.classList.toggle('hidden');
}

function hideViewMenu() {
    document.getElementById('viewMenu').classList.add('hidden');
}

// Task Management
async function loadTasks() {
    try {
        const snapshot = await db.collection('tasks')
            .orderBy('createdAt', 'desc')
            .get();
        
        tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateDashboard();
    } catch (error) {
        console.error('Error loading tasks:', error);
        showMessage('Error loading tasks', 'error');
    }
}

async function createTask(taskData) {
    try {
        const taskRef = await db.collection('tasks').add({
            ...taskData,
            status: 'todo',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName || currentUser.email
        });
        
        const newTask = {
            id: taskRef.id,
            ...taskData,
            status: 'todo',
            createdAt: new Date(),
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName || currentUser.email
        };
        
        tasks.unshift(newTask);
        updateDashboard();
        return newTask;
    } catch (error) {
        console.error('Error creating task:', error);
        showMessage('Error creating task', 'error');
        return null;
    }
}

async function updateTaskStatus(taskId, newStatus) {
    try {
        await db.collection('tasks').doc(taskId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            tasks[taskIndex].status = newStatus;
            tasks[taskIndex].updatedAt = new Date();
            updateDashboard();
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showMessage('Error updating task', 'error');
    }
}

async function deleteTask(taskId) {
    try {
        await db.collection('tasks').doc(taskId).delete();
        tasks = tasks.filter(t => t.id !== taskId);
        updateDashboard();
    } catch (error) {
        console.error('Error deleting task:', error);
        showMessage('Error deleting task', 'error');
    }
}

// User Management
async function loadUsers() {
    try {
        const snapshot = await db.collection('users')
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc')
            .get();
        
        users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        updateAssigneeDropdown();
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function updateAssigneeDropdown() {
    const assigneeSelect = document.getElementById('taskAssignee');
    const workers = users.filter(user => user.role === 'worker');
    
    assigneeSelect.innerHTML = '<option value="">Select a worker</option>' +
        workers.map(user => `<option value="${user.id}">${user.name} (${user.email})</option>`).join('');
}

// Dashboard Updates
function updateDashboard() {
    updateManagerDashboard();
    updateWorkerDashboard();
}

function updateManagerDashboard() {
    const allTasks = getTasksForManager();
    
    // Update stats
    document.getElementById('totalTasks').textContent = allTasks.length;
    document.getElementById('inProgressTasks').textContent = allTasks.filter(t => t.status === 'in_progress').length;
    document.getElementById('completedTasks').textContent = allTasks.filter(t => t.status === 'done').length;
    document.getElementById('blockedTasks').textContent = allTasks.filter(t => t.status === 'blocked').length;
    
    // Update recent tasks
    const recentTasksList = document.getElementById('recentTasksList');
    const recentTasks = allTasks.slice(0, 5);
    
    if (recentTasks.length === 0) {
        recentTasksList.innerHTML = `
            <div class="p-6 text-center text-gray-500">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>No tasks yet. Create your first task!</p>
            </div>
        `;
    } else {
        recentTasksList.innerHTML = recentTasks.map(task => createTaskCard(task, 'manager')).join('');
    }
}

function updateWorkerDashboard() {
    const workerTasks = getTasksForWorker();
    
    // Update stats
    document.getElementById('workerTotalTasks').textContent = workerTasks.length;
    document.getElementById('workerInProgressTasks').textContent = workerTasks.filter(t => t.status === 'in_progress').length;
    document.getElementById('workerCompletedTasks').textContent = workerTasks.filter(t => t.status === 'done').length;
    document.getElementById('workerBlockedTasks').textContent = workerTasks.filter(t => t.status === 'blocked').length;
    
    // Update tasks list
    const workerTasksList = document.getElementById('workerTasksList');
    
    if (workerTasks.length === 0) {
        workerTasksList.innerHTML = `
            <div class="p-6 text-center text-gray-500">
                <i class="fas fa-clipboard-check text-4xl mb-4"></i>
                <p>No tasks assigned to you yet.</p>
            </div>
        `;
    } else {
        workerTasksList.innerHTML = workerTasks.map(task => createTaskCard(task, 'worker')).join('');
    }
}

function getTasksForManager() {
    if (currentUser.role === 'manager') {
        return tasks;
    }
    return [];
}

function getTasksForWorker() {
    return tasks.filter(task => task.assigneeId === currentUser.uid);
}

// Task Card HTML
function createTaskCard(task, viewType) {
    const priorityColors = {
        low: 'bg-gray-100 text-gray-800',
        medium: 'bg-yellow-100 text-yellow-800',
        high: 'bg-red-100 text-red-800'
    };
    
    const statusColors = {
        todo: 'bg-gray-100 text-gray-800',
        in_progress: 'bg-blue-100 text-blue-800',
        done: 'bg-green-100 text-green-800',
        blocked: 'bg-red-100 text-red-800'
    };
    
    const statusIcons = {
        todo: 'fa-clock',
        in_progress: 'fa-spinner',
        done: 'fa-check-circle',
        blocked: 'fa-exclamation-triangle'
    };
    
    const assignee = users.find(u => u.id === task.assigneeId);
    
    return `
        <div class="p-6 hover:bg-gray-50 transition-colors">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h3 class="text-lg font-medium text-gray-900 mb-2">${task.title}</h3>
                    <p class="text-gray-600 mb-3">${task.description || 'No description'}</p>
                    <div class="flex flex-wrap gap-2 text-sm">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority]}">
                            <i class="fas fa-flag mr-1"></i>${task.priority}
                        </span>
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[task.status]}">
                            <i class="fas ${statusIcons[task.status]} mr-1"></i>${formatStatus(task.status)}
                        </span>
                        ${task.dueDate ? `
                            <span class="text-gray-500">
                                <i class="fas fa-calendar mr-1"></i>${formatDate(task.dueDate)}
                            </span>
                        ` : ''}
                        ${viewType === 'manager' && assignee ? `
                            <span class="text-gray-500">
                                <i class="fas fa-user mr-1"></i>${assignee.name}
                            </span>
                        ` : ''}
                        ${task.createdByName ? `
                            <span class="text-gray-400">
                                <i class="fas fa-plus-circle mr-1"></i>by ${task.createdByName}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="ml-4 flex flex-col space-y-2">
                    ${viewType === 'worker' && task.status !== 'done' ? `
                        <button onclick="markTaskComplete('${task.id}')" 
                            class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors">
                            <i class="fas fa-check mr-1"></i>Complete
                        </button>
                    ` : ''}
                    ${viewType === 'manager' ? `
                        <button onclick="deleteTask('${task.id}')" 
                            class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Task Actions
function markTaskComplete(taskId) {
    if (confirm('Mark this task as complete?')) {
        updateTaskStatus(taskId, 'done');
        showNotification('Task marked as complete!', 'success');
    }
}

// Create Task Modal
function showCreateTaskForm() {
    document.getElementById('createTaskModal').classList.remove('hidden');
}

function hideCreateTaskForm() {
    document.getElementById('createTaskModal').classList.add('hidden');
    document.getElementById('createTaskForm').reset();
}

document.getElementById('createTaskForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        priority: document.getElementById('taskPriority').value,
        dueDate: document.getElementById('taskDueDate').value,
        assigneeId: document.getElementById('taskAssignee').value
    };
    
    await createTask(taskData);
    hideCreateTaskForm();
    showNotification('Task created successfully!', 'success');
});

// All Tasks Modal
function showAllTasks() {
    document.getElementById('allTasksModal').classList.remove('hidden');
    renderAllTasks();
}

function hideAllTasks() {
    document.getElementById('allTasksModal').classList.add('hidden');
}

function renderAllTasks() {
    const allTasksList = document.getElementById('allTasksList');
    const filteredTasks = getFilteredTasks();
    
    if (filteredTasks.length === 0) {
        allTasksList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-search text-4xl mb-4"></i>
                <p>No tasks found matching your filters</p>
            </div>
        `;
    } else {
        allTasksList.innerHTML = `
            <div class="space-y-2">
                ${filteredTasks.map(task => createTaskCard(task, 'manager')).join('')}
            </div>
        `;
    }
}

function filterTasks() {
    renderAllTasks();
}

function getFilteredTasks() {
    const statusFilter = document.getElementById('filterStatus').value;
    const priorityFilter = document.getElementById('filterPriority').value;
    
    return tasks.filter(task => {
        const statusMatch = !statusFilter || task.status === statusFilter;
        const priorityMatch = !priorityFilter || task.priority === priorityFilter;
        return statusMatch && priorityMatch;
    });
}

// Users Modal
function showUsers() {
    document.getElementById('usersModal').classList.remove('hidden');
    renderUsers();
}

function hideUsers() {
    document.getElementById('usersModal').classList.add('hidden');
}

function renderUsers() {
    const usersList = document.getElementById('usersList');
    
    if (users.length === 0) {
        usersList.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-users text-4xl mb-4"></i>
                <p>No users found</p>
            </div>
        `;
    } else {
        usersList.innerHTML = users.map(user => `
            <div class="bg-white p-4 rounded-lg shadow border">
                <div class="flex items-center mb-2">
                    <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <i class="fas fa-user text-blue-600"></i>
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-900">${user.name}</h4>
                        <p class="text-sm text-gray-500">${user.email}</p>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <span class="px-2 py-1 text-xs rounded-full ${user.role === 'manager' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}">
                        ${user.role}
                    </span>
                    <span class="text-xs text-gray-400">
                        Joined ${formatDate(user.createdAt)}
                    </span>
                </div>
            </div>
        `).join('');
    }
}

// Utility Functions
function formatStatus(status) {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(dateString) {
    if (!dateString) return 'No date';
    const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('authMessage');
    const colors = {
        success: 'text-green-600',
        error: 'text-red-600',
        info: 'text-blue-600'
    };
    
    messageEl.textContent = message;
    messageEl.className = `mt-4 text-center text-sm ${colors[type]}`;
    messageEl.classList.remove('hidden');
    
    setTimeout(() => {
        messageEl.classList.add('hidden');
    }, 5000);
}

function showNotification(message, type = 'info') {
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-check-circle mr-2"></i>
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Close modals when clicking outside
window.onclick = function(event) {
    const createModal = document.getElementById('createTaskModal');
    const allTasksModal = document.getElementById('allTasksModal');
    const usersModal = document.getElementById('usersModal');
    const viewMenu = document.getElementById('viewMenu');
    
    if (event.target === createModal) {
        hideCreateTaskForm();
    }
    if (event.target === allTasksModal) {
        hideAllTasks();
    }
    if (event.target === usersModal) {
        hideUsers();
    }
    if (!event.target.closest('#viewSwitcher') && !viewMenu.classList.contains('hidden')) {
        hideViewMenu();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        hideCreateTaskForm();
        hideAllTasks();
        hideUsers();
        hideViewMenu();
    }
});
