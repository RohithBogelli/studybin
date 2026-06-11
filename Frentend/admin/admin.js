const API = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1")
  ? "http://localhost:5000/api"
  : "https://project-cloudmama.onrender.com/api";

let currentTab = "overview";
let trafficChartInstance = null;
let subjectChartInstance = null;

// AUTH CHECK ON LOAD
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const user = JSON.parse(localStorage.getItem("sb_user") || localStorage.getItem("cm_user") || "null");

  if (!token || !user || user.role !== "admin") {
    document.getElementById("accessDenied").style.display = "block";
    document.getElementById("adminContent").style.display = "none";
  } else {
    document.getElementById("accessDenied").style.display = "none";
    document.getElementById("adminContent").style.display = "block";
    document.getElementById("adminNameDisplay").textContent = user.name;
    
    loadDashboardData();
  }
});

function redirectToLogin() {
  window.location.href = "../index.html";
}

function adminLogout() {
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_user");
  localStorage.removeItem("cm_token");
  localStorage.removeItem("cm_user");
  window.location.href = "../index.html";
}

// SWITCH SUBTABS IN OWNER PANEL
function switchAdminHubTab(tabName) {
  currentTab = tabName;

  const tabs = ["overview", "ads", "students", "notes", "colleges"];
  tabs.forEach(t => {
    const btn = document.getElementById(`btnAdminTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const panel = document.getElementById(`adminPanel${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle("active", t === tabName);
    if (panel) panel.style.display = t === tabName ? "block" : "none";
  });

  if (tabName === "overview") loadDashboardData();
  if (tabName === "ads") loadAdCampaigns();
  if (tabName === "students") loadStudentsList();
  if (tabName === "notes") loadNotesList();
  if (tabName === "colleges") loadCollegesList();
}

// LOAD STATS & TRAFFIC ANALYTICS
async function loadDashboardData() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/stats`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById("adminStatStudents").textContent = data.totalStudents;
      document.getElementById("adminStatNotes").textContent = data.totalNotes;
      document.getElementById("adminStatColleges").textContent = data.totalColleges;

      // Draw Charts if on Overview tab
      if (currentTab === "overview") {
        renderTrafficChart(data.trafficStats || []);
        renderSubjectChart(data.subjectStats || []);
      }
    }
  } catch (error) {
    console.error("Error fetching stats data:", error);
  }
}

// CHART 1: TRAFFIC & DAILY LOGINS
function renderTrafficChart(logs) {
  const ctx = document.getElementById("trafficChart").getContext("2d");
  
  // Prepare labels (last 7 days dates) and login counts
  const labels = [];
  const counts = [];
  
  // Fill array with last 7 days dates
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    
    // Find matching date in database logs
    const match = logs.find(log => log._id === dateStr);
    counts.push(match ? match.count : 0);
  }

  if (trafficChartInstance) {
    trafficChartInstance.destroy();
  }

  trafficChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Sessions / Logins",
        data: counts,
        borderColor: "#22d3ee",
        backgroundColor: "rgba(34, 211, 238, 0.1)",
        borderWidth: 3,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#8b5cf6",
        pointBorderColor: "#fff",
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#94a3b8", precision: 0 },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        x: {
          ticks: { color: "#94a3b8" },
          grid: { display: false }
        }
      }
    }
  });
}

// CHART 2: NOTE UPLOADS BY SUBJECT
function renderSubjectChart(stats) {
  const ctx = document.getElementById("subjectChart").getContext("2d");
  
  const labels = stats.map(s => s._id || "General");
  const counts = stats.map(s => s.count);

  if (subjectChartInstance) {
    subjectChartInstance.destroy();
  }

  // Fallback if no materials uploaded yet
  const displayLabels = labels.length > 0 ? labels : ["DBMS", "Maths", "CN", "Physics"];
  const displayCounts = counts.length > 0 ? counts : [0, 0, 0, 0];

  subjectChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: displayLabels,
      datasets: [{
        data: displayCounts,
        backgroundColor: ["#8b5cf6", "#7c3aed", "#22d3ee", "#06b6d4", "#10b981"],
        borderWidth: 0,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#94a3b8", precision: 0 },
          grid: { color: "rgba(255,255,255,0.05)" }
        },
        x: {
          ticks: { color: "#94a3b8" },
          grid: { display: false }
        }
      }
    }
  });
}

// TAB 2: AD CAMPAIGNS PLACEMENTS MANAGER
async function loadAdCampaigns() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const container = document.getElementById("adCampaignList");
  container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--muted)">Loading ad campaigns...</div>`;

  try {
    const res = await fetch(`${API}/admin/ads`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const ads = await res.json();

    if (res.ok) {
      if (ads.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--muted)">No campaigns running. Create one on the left!</div>`;
        return;
      }
      container.innerHTML = "";
      ads.forEach(ad => {
        const item = document.createElement("div");
        item.className = "ad-card-item";
        
        const placementName = ad.placement === "home_banner" ? "Home Banner" : "Login Sidebar";
        const toggleClass = ad.isActive ? "btn-toggle-ad" : "btn-toggle-ad inactive";
        const toggleLabel = ad.isActive ? "Active (On)" : "Inactive (Off)";

        item.innerHTML = `
          <div class="ad-card-details">
            <span class="ad-placement-badge">${placementName}</span>
            <h4 style="margin-top:0.4rem">${ad.title}</h4>
            <p>${ad.description}</p>
            <span style="font-size:0.75rem; color:var(--primary)">Sponsor: ${ad.sponsorName} | Link: ${ad.link || "None"}</span>
          </div>
          <div class="ad-actions">
            <button class="${toggleClass}" onclick="toggleAdStatus('${ad._id}')">${toggleLabel}</button>
            <button class="btn-ghost" style="padding:4px 8px; font-size:0.75rem" onclick="editAdCampaign('${encodeURIComponent(JSON.stringify(ad))}')">Edit</button>
            <button class="btn-delete" style="padding:4px 8px; font-size:0.75rem" onclick="deleteAdCampaign('${ad._id}')">🗑</button>
          </div>
        `;
        container.appendChild(item);
      });
    }
  } catch (error) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--error)">Error connecting to Ad Campaigns.</div>`;
  }
}

async function handleSaveAd(e) {
  e.preventDefault();
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  
  const body = {
    id:          document.getElementById("adId").value || null,
    placement:   document.getElementById("adPlacement").value,
    sponsorName: document.getElementById("adSponsorName").value.trim(),
    title:       document.getElementById("adTitle").value.trim(),
    description: document.getElementById("adDescription").value.trim(),
    link:        document.getElementById("adLink").value.trim()
  };

  try {
    const res = await fetch(`${API}/admin/ads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      resetAdForm();
      loadAdCampaigns();
      alert("Campaign saved successfully!");
    } else {
      alert("Error saving: " + data.message);
    }
  } catch {
    alert("Connection error!");
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
      loadAdCampaigns();
    }
  } catch {
    alert("Connection error!");
  }
}

async function deleteAdCampaign(adId) {
  if (!confirm("Are you sure you want to delete this sponsor ad campaign?")) return;
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/ads/${adId}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      loadAdCampaigns();
    }
  } catch {
    alert("Connection error!");
  }
}

function editAdCampaign(encodedAd) {
  const ad = JSON.parse(decodeURIComponent(encodedAd));
  document.getElementById("adId").value = ad._id;
  document.getElementById("adPlacement").value = ad.placement;
  document.getElementById("adSponsorName").value = ad.sponsorName;
  document.getElementById("adTitle").value = ad.title;
  document.getElementById("adDescription").value = ad.description;
  document.getElementById("adLink").value = ad.link || "";
  
  document.getElementById("adFormTitle").textContent = "📝 Edit Campaign Placements";
}

function resetAdForm() {
  document.getElementById("adCampaignForm").reset();
  document.getElementById("adId").value = "";
  document.getElementById("adFormTitle").textContent = "📢 Set Ad Placement";
}

// TAB 3: MANAGE STUDENTS LIST
async function loadStudentsList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("studentsTableBody");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">Loading student records...</td></tr>`;

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
        
        const joinDate = new Date(student.createdAt).toLocaleDateString();

        row.innerHTML = `
          <td><strong>${student.name}</strong></td>
          <td>${student.email}</td>
          <td>${student.college}</td>
          <td>${joinDate}</td>
          <td><span class="${statusClass}">${statusText}</span></td>
          <td>${actionBtn}</td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--error)">Error loading student records.</td></tr>`;
  }
}

async function toggleStudentStatus(userId, action) {
  const confirmMsg = action === "block"
    ? "Are you sure you want to BLOCK this student? They will lose dashboard access immediately!"
    : "Are you sure you want to unblock this student?";

  if (!confirm(confirmMsg)) return;

  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/users/${userId}/${action}`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      loadStudentsList();
      loadDashboardData();
    } else {
      alert("Action failed!");
    }
  } catch {
    alert("Connection error!");
  }
}

// TAB 4: MODERATE NOTES LIST
async function loadNotesList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("notesTableBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">Loading uploads...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/notes`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const notes = await res.json();

    if (res.ok) {
      tbody.innerHTML = "";
      if (notes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">No uploaded materials yet.</td></tr>`;
        return;
      }

      notes.forEach(note => {
        const row = document.createElement("tr");
        const uploadDate = new Date(note.createdAt).toLocaleDateString();
        const fileLink = note.fileUrl
          ? `<a href="${note.fileUrl}" target="_blank" style="color:var(--accent);text-decoration:none">View File ↗</a>`
          : `<span style="color:var(--muted)">No file</span>`;

        row.innerHTML = `
          <td><strong>${note.title}</strong></td>
          <td><span class="note-subject" style="margin:0">${note.subject || "General"}</span></td>
          <td>${note.college}</td>
          <td>${note.uploadedBy || "Unknown"}</td>
          <td>${uploadDate}</td>
          <td>${fileLink}</td>
          <td><button class="btn-delete" style="padding:4px 10px; font-size:0.75rem" onclick="deleteNoteHub('${note._id}')">🗑 Remove Note</button></td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--error)">Error loading study materials.</td></tr>`;
  }
}

async function deleteNoteHub(noteId) {
  if (!confirm("Are you sure you want to remove this study material from StudyBin?")) return;
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  try {
    const res = await fetch(`${API}/admin/notes/${noteId}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });
    if (res.ok) {
      loadNotesList();
      loadDashboardData();
    } else {
      alert("Failed to delete note.");
    }
  } catch {
    alert("Connection error!");
  }
}

// TAB 5: COLLEGES LIST
async function loadCollegesList() {
  const token = localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
  const tbody = document.getElementById("collegesTableBody");
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center">Loading directory...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/colleges`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const colleges = await res.json();

    if (res.ok) {
      tbody.innerHTML = "";
      if (colleges.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center">No colleges registered.</td></tr>`;
        return;
      }

      colleges.forEach(college => {
        const row = document.createElement("tr");
        const createDate = new Date(college.createdAt).toLocaleDateString();

        row.innerHTML = `
          <td><strong>${college.name}</strong></td>
          <td><code style="font-family:'JetBrains Mono', monospace; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:4px">${college.pincode}</code></td>
          <td>${createDate}</td>
        `;
        tbody.appendChild(row);
      });
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--error)">Error loading college directory.</td></tr>`;
  }
}
