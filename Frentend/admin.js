// StudyBin Dynamic Admin Hub Controller
const API = window.location.protocol === "file:" ||
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000/api"
  : (() => {
      const path = window.location.pathname;
      const dir = path.substring(0, path.lastIndexOf('/'));
      return window.location.origin + dir + "/api";
    })();

let currentTab = "dashboard";
let globalStats = {};

// AUTH CONTROLLER & INIT
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const user = JSON.parse(localStorage.getItem("sb_user") || localStorage.getItem("cm_user") || "null");

  if (!token || !user || user.role !== "admin") {
    document.getElementById("accessDenied").style.display = "block";
    document.getElementById("adminContent").style.display = "none";
  } else {
    document.getElementById("accessDenied").style.display = "none";
    document.getElementById("adminContent").style.display = "flex";
    document.getElementById("adminNameDisplay").textContent = user.name;
    
    // Initial Load
    loadDashboardData();
  }
});

function redirectToLogin() {
  window.location.href = "index.html";
}

function adminLogout() {
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_user");
  localStorage.removeItem("cm_token");
  localStorage.removeItem("cm_user");
  window.location.href = "index.html";
}

// TAB ROUTING
function switchTab(tabName) {
  currentTab = tabName;

  // Toggle active menu items
  const menuButtons = {
    dashboard: "menuBtnDashboard",
    users: "menuBtnUsers",
    notes: "menuBtnNotes",
    reports: "menuBtnReports",
    settings: "menuBtnSettings"
  };

  Object.keys(menuButtons).forEach(key => {
    const el = document.getElementById(menuButtons[key]);
    if (el) el.classList.toggle("active", key === tabName);
  });

  // Toggle active view sections
  const viewSections = {
    dashboard: "viewDashboard",
    users: "viewUsers",
    notes: "viewNotes",
    reports: "viewReports",
    settings: "viewSettings"
  };

  Object.keys(viewSections).forEach(key => {
    const el = document.getElementById(viewSections[key]);
    if (el) el.style.display = (key === tabName) ? "block" : "none";
  });

  // Update header text based on mockup
  const titles = {
    dashboard: ["Admin Overview", "Welcome back, Administrator. Here's what's happening today."],
    users: ["User Directory", "Manage all registered students and their access status."],
    notes: ["Course Moderation", "Audit, inspect, and remove notes uploaded by students."],
    reports: ["Content Safety Reports", "Evaluate and remove documents flagged by AI moderation."],
    settings: ["Platform Advertising Campaigns", "Create, update, and manage sponsored placement spaces."]
  };

  if (titles[tabName]) {
    document.getElementById("pageTitle").textContent = titles[tabName][0];
    document.getElementById("pageSubtitle").textContent = titles[tabName][1];
  }

  // Load appropriate data
  if (tabName === "dashboard") loadDashboardData();
  if (tabName === "users") loadStudentsList();
  if (tabName === "notes") loadNotesList();
  if (tabName === "reports") loadReportsList();
  if (tabName === "settings") loadAdsList();
}

// FORMAT TIME ELAPSED (Mockup Helper)
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ----------------------------------------------------
// API REQUESTS & DATA RENDERING
// ----------------------------------------------------

async function loadDashboardData() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/stats`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    if (res.ok) {
      globalStats = data;
      
      // Update counters
      document.getElementById("statStudents").textContent = data.totalStudents.toLocaleString();
      document.getElementById("statNotes").textContent = data.totalNotes.toLocaleString();
      document.getElementById("statGroups").textContent = data.totalColleges.toLocaleString();
      
      const flaggedCount = data.totalFlagged || 0;
      document.getElementById("statFlagged").textContent = flaggedCount;
      document.getElementById("actionReviewFlaggedText").textContent = `${flaggedCount} items pending review`;
      
      // Render Charts & Activity
      renderTopSubjects(data.subjectStats || []);
      loadRecentActivityList();
    }
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

// RENDER TOP SUBJECTS PROGRESS BARS
function renderTopSubjects(subjectStats) {
  const list = document.getElementById("topSubjectsList");
  list.innerHTML = "";

  if (subjectStats.length === 0) {
    list.innerHTML = `<div style="text-align:center; color:var(--muted); font-size:0.88rem">No note subjects categorized.</div>`;
    return;
  }

  // Get max count to calculate percentages
  const maxCount = Math.max(...subjectStats.map(s => s.count), 1);

  subjectStats.forEach(subject => {
    const percentage = Math.round((subject.count / maxCount) * 100);
    const row = document.createElement("div");
    row.className = "subject-row";
    row.innerHTML = `
      <div class="subject-info">
        <span>${subject._id || "General"}</span>
        <span style="color:var(--accent)">${percentage}%</span>
      </div>
      <div class="subject-progress-container">
        <div class="subject-progress-bar" style="width: ${percentage}%"></div>
      </div>
    `;
    list.appendChild(row);
  });
}

// GENERATE DYNAMIC RECENT ACTIVITY LIST FROM DATABASE DATA
async function loadRecentActivityList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("activityTableBody");
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted)">Loading recent activities...</td></tr>`;

  try {
    // Fetch users and notes concurrently to build activity feed
    const [usersRes, notesRes] = await Promise.all([
      fetch(`${API}/admin/users`, { headers: { "Authorization": "Bearer " + token } }),
      fetch(`${API}/admin/notes`, { headers: { "Authorization": "Bearer " + token } })
    ]);

    const users = await usersRes.json();
    const notes = await notesRes.json();

    if (usersRes.ok && notesRes.ok) {
      const activities = [];

      // Map registrations
      users.forEach(user => {
        activities.push({
          name: user.name,
          type: user.role === "admin" ? "Admin Account" : "New User",
          action: "Profile Setup",
          status: user.isBlocked ? "Blocked" : "Active",
          time: user.created_at || user.createdAt,
          avatarClass: "avatar-blue"
        });
      });

      // Map uploads
      notes.forEach(note => {
        activities.push({
          name: note.uploadedBy || "Student",
          type: "Resources Uploaded",
          action: note.title,
          status: note.isFlagged ? "Flagged" : "Active",
          time: note.created_at || note.createdAt,
          avatarClass: note.isFlagged ? "avatar-orange" : "avatar-purple"
        });
      });

      // Sort by time descending
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));

      // Display top 4 recent activities
      const displayList = activities.slice(0, 4);
      tbody.innerHTML = "";

      if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--muted)">No recent platform activity.</td></tr>`;
        return;
      }

      displayList.forEach(act => {
        const tr = document.createElement("tr");
        tr.style.background = "rgba(255, 255, 255, 0.01)";
        tr.style.borderBottom = "1px solid var(--border)";
        
        const initials = act.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        const statusBadge = act.status === "Blocked" || act.status === "Flagged"
          ? `<span class="badge-status blocked">${act.status}</span>`
          : `<span class="badge-status active">Active</span>`;

        tr.innerHTML = `
          <td style="display:flex; align-items:center; gap:0.8rem; border:none; padding: 0.8rem 1rem">
            <div class="avatar-circle ${act.avatarClass}">${initials}</div>
            <div class="activity-info">
              <div style="font-weight:700; color:var(--text)">${act.name}</div>
              <div style="font-size:0.75rem; color:var(--muted)">${act.type}</div>
            </div>
          </td>
          <td style="border:none; padding: 0.8rem 1rem">
            <span style="font-weight:600; color:#3b82f6">${act.action}</span>
          </td>
          <td style="border:none; padding: 0.8rem 1rem">
            <span style="color:#3b82f6; font-weight:600">${statusBadge}</span>
          </td>
          <td style="font-family:'JetBrains Mono', monospace; font-size:0.78rem; border:none; padding: 0.8rem 1rem; color:#3b82f6; font-weight:600">
            ${formatTimeAgo(act.time)}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--error)">Error loading activities.</td></tr>`;
  }
}

// ----------------------------------------------------
// VIEW 2: USER DIRECTORY
// ----------------------------------------------------
async function loadStudentsList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("studentsTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted)">Loading student list...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/users`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const users = await res.json();

    if (res.ok) {
      tbody.innerHTML = "";
      const students = users.filter(u => u.role !== "admin");

      if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">No students registered yet.</td></tr>`;
        return;
      }

      students.forEach(student => {
        const row = document.createElement("tr");
        const statusText = student.isBlocked ? "Blocked" : "Active";
        const statusClass = student.isBlocked ? "badge-status blocked" : "badge-status active";
        
        const actionBtn = student.isBlocked
          ? `<button class="btn-unblock-action" onclick="toggleStudentStatus('${student._id}', 'unblock')">🔓 Unblock</button>`
          : `<button class="btn-block-action" onclick="toggleStudentStatus('${student._id}', 'block')">🔒 Block Student</button>`;
        
        const joinDate = new Date(student.created_at || student.createdAt).toLocaleDateString();

        row.innerHTML = `
          <td><strong style="color:#ef4444">${student.name}</strong></td>
          <td style="color:#3b82f6; font-weight:600">${student.email}</td>
          <td style="color:#3b82f6; font-weight:600">${student.college}</td>
          <td style="color:#3b82f6; font-weight:600">${joinDate}</td>
          <td><span class="${statusClass}">${statusText}</span></td>
          <td>${actionBtn}</td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--error)">Error connecting to students list.</td></tr>`;
  }
}

async function toggleStudentStatus(userId, action) {
  const confirmMsg = action === "block"
    ? "Are you sure you want to BLOCK this student? They will be locked out of StudyBin!"
    : "Are you sure you want to unblock this student?";

  if (!confirm(confirmMsg)) return;

  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/users/${userId}/${action}`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      // Reload stats and user directory
      loadDashboardData();
      loadStudentsList();
    } else {
      alert("Action failed!");
    }
  } catch {
    alert("Connection error!");
  }
}

// ----------------------------------------------------
// VIEW 3: COURSE MODERATION (ALL NOTE MATERIALS)
// ----------------------------------------------------
async function loadNotesList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("notesTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--muted)">Loading uploads...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/notes`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const notes = await res.json();

    if (res.ok) {
      tbody.innerHTML = "";
      if (notes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">No materials found.</td></tr>`;
        return;
      }

      notes.forEach(note => {
        const row = document.createElement("tr");
        const uploadDate = new Date(note.created_at || note.createdAt).toLocaleDateString();
        
        const fileLink = note.fileUrl
          ? `<a href="${note.fileUrl}" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:700">View Document ↗</a>`
          : `<span style="color:var(--muted)">No File</span>`;

        // Safety indicators
        const safetyBadge = note.isFlagged
          ? `<span class="badge-status blocked" style="cursor:help" title="${note.flagReason || 'Flagged content'}">⚠️ Flagged: ${note.flagReason || 'Adult/Inappropriate'}</span>`
          : `<span class="badge-status active">✅ Safe</span>`;

        row.innerHTML = `
          <td><strong style="color:#3b82f6">${note.title}</strong></td>
          <td><span class="note-subject" style="margin:0; color:#3b82f6">${note.subject || "General"}</span></td>
          <td style="color:#3b82f6; font-weight:600">${note.college}</td>
          <td style="color:#ef4444; font-weight:700">${note.uploadedBy || "Unknown"}</td>
          <td>${safetyBadge}</td>
          <td>${fileLink}</td>
          <td><button class="btn-delete" style="padding:5px 12px; font-size:0.75rem" onclick="deleteNoteHub('${note._id}')">🗑 Remove Note</button></td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--error)">Error connecting to uploaded list.</td></tr>`;
  }
}

async function deleteNoteHub(noteId) {
  if (!confirm("Are you sure you want to remove this study note from the platform? This will delete the note and its file permanently!")) return;
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/notes/${noteId}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      // Refresh current active view and statistics
      loadDashboardData();
      if (currentTab === "notes") loadNotesList();
      if (currentTab === "reports") loadReportsList();
    } else {
      alert("Failed to delete note.");
    }
  } catch {
    alert("Connection error!");
  }
}

// ----------------------------------------------------
// VIEW 4: CONTENT REPORTS (FLAGGED NOTES ONLY)
// ----------------------------------------------------
async function loadReportsList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("reportsTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--muted)">Loading reports directory...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/notes`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const notes = await res.json();

    if (res.ok) {
      tbody.innerHTML = "";
      const flaggedNotes = notes.filter(n => n.isFlagged === true);

      if (flaggedNotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 3rem 0; color: var(--success); font-weight:700">🎉 Great news! No reported or flagged items pending review.</td></tr>`;
        return;
      }

      flaggedNotes.forEach(note => {
        const row = document.createElement("tr");
        const fileLink = note.fileUrl
          ? `<a href="${note.fileUrl}" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:700">View Document ↗</a>`
          : `<span style="color:var(--muted)">No File</span>`;

        row.innerHTML = `
          <td><strong style="color:#f87171">${note.title}</strong></td>
          <td><span class="note-subject" style="margin:0; color:#3b82f6">${note.subject || "General"}</span></td>
          <td style="color:#3b82f6; font-weight:600">${note.college}</td>
          <td style="color:#3b82f6; font-weight:600">${note.uploadedBy || "Unknown"}</td>
          <td style="color: #f87171; font-weight:600">⚠️ ${note.flagReason || "Adult/Inappropriate"}</td>
          <td>${fileLink}</td>
          <td><button class="btn-delete" style="padding:5px 12px; font-size:0.75rem; background:rgba(239, 68, 68, 0.15)" onclick="deleteNoteHub('${note._id}')">🗑 Remove Note</button></td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--error)">Error loading reports.</td></tr>`;
  }
}

// ----------------------------------------------------
// VIEW 5: PLATFORM SETTINGS (ADS CAMPAIGNS)
// ----------------------------------------------------
async function loadAdsList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("adsTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--muted)">Loading ad campaigns...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/ads`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const ads = await res.json();

    if (res.ok) {
      tbody.innerHTML = "";
      if (ads.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">No active sponsored campaigns.</td></tr>`;
        return;
      }

      ads.forEach(ad => {
        const row = document.createElement("tr");
        const statusText = ad.isActive ? "Running" : "Paused";
        const statusClass = ad.isActive ? "badge-status active" : "badge-status blocked";
        
        row.innerHTML = `
          <td><strong style="color:#3b82f6">${ad.sponsorName}</strong></td>
          <td style="font-family:'JetBrains Mono', monospace; font-size:0.82rem; color:#3b82f6; font-weight:600">${ad.placement}</td>
          <td style="color:#3b82f6; font-weight:600">${ad.title}</td>
          <td><a href="${ad.link}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:0.8rem">Visit Link ↗</a></td>
          <td><span class="${statusClass}">${statusText}</span></td>
          <td style="display:flex; gap:5px">
            <button class="btn-unblock-action" style="padding:3px 8px; font-size:0.72rem" onclick="toggleAdStatus('${ad._id}')">Toggle</button>
            <button class="btn-primary" style="width:auto; padding:3px 8px; font-size:0.72rem; background:rgba(255,255,255,0.05); color:#cbd5e1" onclick="editAdCampaign('${encodeURIComponent(JSON.stringify(ad))}')">Edit</button>
            <button class="btn-delete" style="padding:3px 8px; font-size:0.72rem" onclick="deleteAdCampaign('${ad._id}')">Delete</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--error)">Error loading ad campaigns.</td></tr>`;
  }
}

async function toggleAdStatus(adId) {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/ads/${adId}/toggle`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      loadAdsList();
    }
  } catch {
    alert("Connection error!");
  }
}

async function deleteAdCampaign(adId) {
  if (!confirm("Are you sure you want to remove this ad campaign?")) return;
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/ads/${adId}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      loadAdsList();
    }
  } catch {
    alert("Connection error!");
  }
}

function editAdCampaign(adJsonUrl) {
  const ad = JSON.parse(decodeURIComponent(adJsonUrl));
  
  document.getElementById("adId").value = ad._id;
  document.getElementById("adSponsorName").value = ad.sponsorName;
  document.getElementById("adTitle").value = ad.title;
  document.getElementById("adLink").value = ad.link;
  document.getElementById("adDesc").value = ad.description;
  document.getElementById("adPlacement").value = ad.placement;
  
  // Show existing poster if present
  clearAdPoster();
  if (ad.posterUrl) {
    const existingDiv = document.getElementById("adExistingPoster");
    const existingLink = document.getElementById("adExistingPosterLink");
    existingDiv.style.display = "block";
    existingLink.href = ad.posterUrl;
  } else {
    document.getElementById("adExistingPoster").style.display = "none";
  }
  
  document.getElementById("adFormTitle").textContent = "⚙️ Edit Ad Campaign: " + ad.sponsorName;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSaveAd(e) {
  e.preventDefault();
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  
  const idVal = document.getElementById("adId").value;

  // Use FormData to support poster image file upload
  const formData = new FormData();
  formData.append("placement", document.getElementById("adPlacement").value);
  formData.append("title", document.getElementById("adTitle").value.trim());
  formData.append("description", document.getElementById("adDesc").value.trim());
  formData.append("link", document.getElementById("adLink").value.trim());
  formData.append("sponsorName", document.getElementById("adSponsorName").value.trim());
  if (idVal) formData.append("id", idVal);

  // Attach poster image if selected
  const posterFile = document.getElementById("adPosterFile").files[0];
  if (posterFile) formData.append("posterImage", posterFile);

  const msgEl = document.getElementById("adMsg");
  msgEl.textContent = posterFile ? "Uploading poster & saving campaign..." : "Saving campaign...";
  msgEl.className = "msg";

  try {
    const res = await fetch(`${API}/admin/ads`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token },
      // Note: NO Content-Type header — browser sets it automatically with boundary for FormData
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      msgEl.textContent = "✅ Campaign saved successfully!";
      msgEl.className = "msg success";
      resetAdForm();
      loadAdsList();
    } else {
      msgEl.textContent = "❌ " + (data.error || data.message || "An unknown error occurred");
      msgEl.className = "msg error";
    }
  } catch (err) {
    console.error("Save ad error:", err);
    msgEl.textContent = "❌ Connection error or invalid response.";
    msgEl.className = "msg error";
  }
}

function resetAdForm() {
  document.getElementById("adId").value = "";
  document.getElementById("adForm").reset();
  document.getElementById("adFormTitle").textContent = "🚀 Create Sponsor Ad Campaign";
  document.getElementById("adMsg").textContent = "";
  document.getElementById("adMsg").className = "msg";
  clearAdPoster();
  document.getElementById("adExistingPoster").style.display = "none";
}

// POSTER PREVIEW FUNCTIONS
function previewAdPoster() {
  const file = document.getElementById("adPosterFile").files[0];
  if (!file) return;
  document.getElementById("adPosterFileName").textContent = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("adPosterImg").src = e.target.result;
    document.getElementById("adPosterPreview").style.display = "block";
  };
  reader.readAsDataURL(file);
}

function clearAdPoster() {
  document.getElementById("adPosterFile").value = "";
  document.getElementById("adPosterFileName").textContent = "Choose poster image (JPG, PNG, WebP)...";
  document.getElementById("adPosterImg").src = "";
  document.getElementById("adPosterPreview").style.display = "none";
}

// ----------------------------------------------------
// EXPORT REPORTS & ANNOUNCEMENTS
// ----------------------------------------------------
function exportPlatformReport() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(globalStats, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `studybin_report_${new Date().toISOString().slice(0, 10)}.json`);
  dlAnchorElem.click();
}

function openAnnouncementModal() {
  document.getElementById("announcementModal").style.display = "flex";
}

function closeAnnouncementModal() {
  document.getElementById("announcementModal").style.display = "none";
  document.getElementById("annForm").reset();
  document.getElementById("annMsg").textContent = "";
  document.getElementById("annMsg").className = "msg";
}

function handleSendAnnouncement(e) {
  e.preventDefault();
  const title = document.getElementById("annTitle").value.trim();
  const message = document.getElementById("annMessage").value.trim();
  
  const msgEl = document.getElementById("annMsg");
  msgEl.textContent = "Broadcasting announcement...";
  msgEl.className = "msg";
  
  setTimeout(() => {
    msgEl.textContent = "✅ Announcement broadcast successfully to all user feeds!";
    msgEl.className = "msg success";
    setTimeout(() => {
      closeAnnouncementModal();
    }, 1500);
  }, 1000);
}

// PAGE TRANSITION LOADER LOGIC
function transitionToPage(url) {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('active');
    // Wait for 3 seconds animation then navigate
    setTimeout(() => {
      window.location.href = url;
    }, 3000);
  } else {
    window.location.href = url;
  }
}
