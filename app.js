let currentUser = null;
let isEditing = false;
let editingRawId = null;
let currentRawFiles = [];

function showStatus(message, isSuccess = true) {
    const statusDiv = document.getElementById('auth-status');
    statusDiv.innerHTML = `<div class="status-message ${isSuccess ? 'status-success' : 'status-error'}">${message}</div>`;
    setTimeout(() => statusDiv.innerHTML = '', 5000);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-content`).classList.add('active');
    
    if (tabName === 'manage') {
        loadRawFiles();
    } else if (tabName === 'view') {
        populateViewSelector();
    }
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTab(tabName);
    });
});

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showStatus('Login successful!');
    } catch (error) {
        showStatus('Login failed: ' + error.message, false);
    }
});

// Register form
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (password.length < 6) {
        showStatus('Password must be at least 6 characters', false);
        return;
    }

    try {
        await auth.createUserWithEmailAndPassword(email, password);
        showStatus('Registration successful! Please login.');
        switchTab('login');
    } catch (error) {
        showStatus('Registration failed: ' + error.message, false);
    }
});

// Logout
async function logout() {
    try {
        await auth.signOut();
        showStatus('Logged out successfully!');
    } catch (error) {
        showStatus('Logout failed: ' + error.message, false);
    }
}

// Create or Update raw file
document.getElementById('raw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('raw-name').value.trim().toLowerCase();
    const version = document.getElementById('raw-version').value.trim();
    const content = document.getElementById('raw-content').value;
    const createBtn = document.getElementById('create-raw-btn');
    
    if (!name || !version || !content) {
        showStatus('Please fill in all fields', false);
        return;
    }
    
    // Validate name (URL-friendly)
    if (!/^[a-z0-9-]+$/.test(name)) {
        showStatus('Name can only contain lowercase letters, numbers, and hyphens', false);
        return;
    }
    
    // Show loading state
    createBtn.textContent = isEditing ? 'Updating...' : 'Creating...';
    createBtn.classList.add('loading');
    createBtn.disabled = true;
    
    try {
        if (isEditing) {
            // Update existing raw file
            await db.collection('raw_files').doc(editingRawId).update({
                name: name,
                version: version,
                content: content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showStatus('Raw file updated successfully!');
            resetForm();
        } else {
            // Check if name already exists
            const existingSnapshot = await db.collection('raw_files')
                .where('owner', '==', currentUser.email)
                .where('name', '==', name)
                .get();
            
            if (!existingSnapshot.empty) {
                showStatus('A file with this name already exists!', false);
                createBtn.textContent = 'Create Raw File';
                createBtn.classList.remove('loading');
                createBtn.disabled = false;
                return;
            }
            
            // Create new raw file
            await db.collection('raw_files').doc().set({
                name: name,
                version: version,
                content: content,
                owner: currentUser.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showStatus('Raw file created successfully!');
            resetForm();
        }
        
        // Refresh files list
        loadRawFiles();
        
    } catch (error) {
        console.error('Error saving raw file:', error);
        showStatus('Error: ' + error.message, false);
    } finally {
        createBtn.textContent = isEditing ? 'Update Raw File' : 'Create Raw File';
        createBtn.classList.remove('loading');
        createBtn.disabled = false;
    }
});

function resetForm() {
    document.getElementById('raw-form').reset();
    isEditing = false;
    editingRawId = null;
    document.getElementById('create-raw-btn').textContent = 'Create Raw File';
}

// Load raw files
async function loadRawFiles() {
    try {
        const snapshot = await db.collection('raw_files')
            .where('owner', '==', currentUser.email)
            .orderBy('createdAt', 'desc')
            .get();
        
        currentRawFiles = [];
        let html = '';
        
        if (snapshot.empty) {
            html = `
                <div class="empty-state">
                    <p>📄 No raw files created yet</p>
                    <button class="btn btn-primary" onclick="switchTab('create')">Create First File</button>
                </div>
            `;
        } else {
            snapshot.forEach(doc => {
                const file = doc.data();
                currentRawFiles.push({
                    id: doc.id,
                    ...file
                });
                
                const date = file.createdAt ? file.createdAt.toDate().toLocaleDateString() : 'Unknown date';
                const preview = file.content.length > 200 ? 
                    file.content.substring(0, 200) + '...' : file.content;
                
                html += `
                    <div class="raw-file-card">
                        <div class="raw-file-header">
                            <span class="raw-file-name">${file.name} (v${file.version})</span>
                            <a href="/raw.html?name=${file.name}" target="_blank" class="raw-link">
                                /raw/${file.name}
                            </a>
                        </div>
                        <div class="raw-content-preview">${preview}</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                            <span style="color: #94a3b8; font-size: 0.9em;">Created: ${date}</span>
                        </div>
                        <div class="action-buttons">
                            <button class="btn btn-secondary" onclick="editRawFile('${doc.id}')">Edit</button>
                            <button class="btn btn-primary" onclick="viewRawFile('${doc.id}')">View</button>
                            <button class="btn" onclick="deleteRawFile('${doc.id}')" style="background: #dc2626; color: white;">Delete</button>
                        </div>
                    </div>
                `;
            });
        }
        
        document.getElementById('raw-files-list').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading raw files:', error);
        document.getElementById('raw-files-list').innerHTML = 
            '<p style="color: #ff4444;">Error loading files: ' + error.message + '</p>';
    }
}

// Edit raw file
async function editRawFile(fileId) {
    try {
        const fileDoc = await db.collection('raw_files').doc(fileId).get();
        
        if (!fileDoc.exists) {
            showStatus('File not found', false);
            return;
        }
        
        const file = fileDoc.data();
        
        document.getElementById('raw-name').value = file.name;
        document.getElementById('raw-version').value = file.version;
        document.getElementById('raw-content').value = file.content;
        
        // Set editing mode
        isEditing = true;
        editingRawId = fileId;
        document.getElementById('create-raw-btn').textContent = 'Update Raw File';
        
        // Switch to create tab
        switchTab('create');
        
    } catch (error) {
        console.error('Error loading file for edit:', error);
        showStatus('Error loading file: ' + error.message, false);
    }
}

// View raw file
function viewRawFile(fileId) {
    const file = currentRawFiles.find(f => f.id === fileId);
    if (file) {
        document.getElementById('view-raw-select').value = fileId;
        loadRawForView();
        switchTab('view');
    }
}

// Populate view selector
function populateViewSelector() {
    const selector = document.getElementById('view-raw-select');
    selector.innerHTML = '<option value="">-- Select a file --</option>';
    
    currentRawFiles.forEach(file => {
        const option = document.createElement('option');
        option.value = file.id;
        option.textContent = `${file.name} (v${file.version})`;
        selector.appendChild(option);
    });
}

// Load raw for viewing
function loadRawForView() {
    const fileId = document.getElementById('view-raw-select').value;
    if (!fileId) {
        document.getElementById('raw-view-container').classList.add('hidden');
        return;
    }
    
    const file = currentRawFiles.find(f => f.id === fileId);
    if (file) {
        document.getElementById('raw-content-viewer').textContent = file.content;
        document.getElementById('raw-url-display').textContent = window.location.origin + '/raw.html?name=' + file.name;
        document.getElementById('raw-view-container').classList.remove('hidden');
    }
}

// Edit current raw file
function editCurrentRaw() {
    const fileId = document.getElementById('view-raw-select').value;
    if (fileId) {
        editRawFile(fileId);
    }
}

// Copy raw URL
function copyRawUrl() {
    const url = document.getElementById('raw-url-display').textContent;
    navigator.clipboard.writeText(url).then(() => {
        showStatus('URL copied to clipboard!');
    }).catch(err => {
        showStatus('Failed to copy URL: ' + err, false);
    });
}

// Open raw in new tab
function openRawInNewTab() {
    const url = document.getElementById('raw-url-display').textContent;
    window.open(url, '_blank');
}

// Delete raw file
async function deleteRawFile(fileId) {
    if (!confirm('Are you sure you want to delete this raw file?')) {
        return;
    }
    
    try {
        await db.collection('raw_files').doc(fileId).delete();
        showStatus('Raw file deleted successfully!');
        loadRawFiles();
        
        // Clear view if deleted file was being viewed
        if (document.getElementById('view-raw-select').value === fileId) {
            document.getElementById('view-raw-select').value = '';
            document.getElementById('raw-view-container').classList.add('hidden');
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showStatus('Error deleting file: ' + error.message, false);
    }
}

// Firebase Auth State Listener
auth.onAuthStateChanged(user => {
    currentUser = user;
    
    if (user) {
        document.getElementById('auth-card').classList.add('hidden');
        document.getElementById('dashboard-card').classList.remove('hidden');
        document.getElementById('user-email').textContent = user.email;
        
        loadRawFiles();
    } else {
        document.getElementById('auth-card').classList.remove('hidden');
        document.getElementById('dashboard-card').classList.add('hidden');
        resetForm();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Raw Link Manager Initialized');
});
