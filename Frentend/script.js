// Point to localhost backend when opening file directly, otherwise use relative path
const API = window.location.protocol === "file:" ||
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
  ? "http://localhost:5000/api"
  : (() => {
      const path = window.location.pathname;
      const dir = path.substring(0, path.lastIndexOf('/'));
      return window.location.origin + dir + "/api";
    })();

let allNotes = [];
let userSavedNotes = [];
let showingSavedNotesOnly = false;
let loadedAds = [];  // Stores ads fetched from backend
let homeCarouselInterval = null;
let loginCarouselInterval = null;
let currentAdminTab = "students";
let currentNoteIsFlagged = false;
let currentNoteFlagReason = "";

const getToken = () => localStorage.getItem("sb_token") || localStorage.getItem("cm_token");
const getUser  = () => JSON.parse(localStorage.getItem("sb_user") || localStorage.getItem("cm_user") || "null");

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = "msg " + type;
}

// LANDING PAGE ROUTING & NAVIGATION
function showLandingPage() {
  document.getElementById("landingPage").style.display = "block";
  document.getElementById("authSection").style.display = "none";
  document.getElementById("dashboard").style.display   = "none";
  document.getElementById("navHomeLink").classList.add("active");
  document.getElementById("navAboutLink").classList.remove("active");
  // Always reload ads fresh so admin-created ads show immediately
  loadPublicAds();
  
  // Update auth button in nav
  const user = getUser();
  if (user) {
    document.getElementById("loginNavBtn").style.display = "none";
    document.getElementById("logoutBtn").style.display = "inline-block";
    if (user.role === "admin") {
      document.getElementById("adminToggleBtn").style.display = "inline-block";
      document.getElementById("adminToggleBtn").onclick = () => window.location.href = "admin.html";
      
      document.getElementById("navCollege").style.display = "inline-block";
      document.getElementById("navCollege").textContent = "Go to Admin Hub";
      document.getElementById("navCollege").style.cursor = "pointer";
      document.getElementById("navCollege").onclick = () => window.location.href = "admin.html";
    } else {
      // Show user to dashboard link or redirection
      document.getElementById("navCollege").style.display = "inline-block";
      document.getElementById("navCollege").textContent = "Go to Dashboard: " + user.college;
      document.getElementById("navCollege").style.cursor = "pointer";
      document.getElementById("navCollege").onclick = () => showDashboard(user);
    }
  } else {
    document.getElementById("loginNavBtn").style.display = "inline-block";
    document.getElementById("logoutBtn").style.display = "none";
    document.getElementById("adminToggleBtn").style.display = "none";
    document.getElementById("navCollege").style.display = "none";
  }
}

function scrollToAbout() {
  showLandingPage();
  document.getElementById("navHomeLink").classList.remove("active");
  document.getElementById("navAboutLink").classList.add("active");
  document.getElementById("about").scrollIntoView({ behavior: "smooth" });
}

function showAuth(tab) {
  document.getElementById("landingPage").style.display = "none";
  document.getElementById("authSection").style.display = "grid";
  document.getElementById("dashboard").style.display   = "none";
  document.getElementById("adminPanel").style.display   = "none";
  switchTab(tab);
}

function switchTab(tab) {
  document.getElementById("tabLogin").classList.toggle("active", tab === "login");
  document.getElementById("tabRegister").classList.toggle("active", tab === "register");
  document.getElementById("loginForm").style.display    = tab === "login" ? "block" : "none";
  document.getElementById("registerForm").style.display = tab === "register" ? "block" : "none";
}

function switchTabDirect(tab) { switchTab(tab); }

// FILE CHANGER LISTENER
document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("noteFile");
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const name = fileInput.files[0] ? fileInput.files[0].name : "Choose study file (PDF, DOCX, PPT)...";
      document.getElementById("fileName").textContent = name;
    });
  }
  
  // Load dynamic sponsor campaigns from owner
  loadPublicAds();

  // Show home landing by default
  const token = getToken();
  const user  = getUser();
  if (token && user) {
    showDashboard(user);
  } else {
    showLandingPage();
  }
});

async function loadPublicAds() {
  try {
    const res = await fetch(`${API}/admin/public/ads`);
    const ads = await res.json();
    if (res.ok) {
      // Store ads globally so notes grid can use them
      loadedAds = ads;

      // 1. Home banner ad placement (Carousel)
      const homeAds = ads.filter(ad => ad.placement === "home_banner");
      const homeAdSection = document.getElementById("homeAdSection");
      const homeAdTrack = document.getElementById("homeAdTrack");
      
      if (homeCarouselInterval) clearInterval(homeCarouselInterval);
      
      if (homeAds.length > 0 && homeAdSection && homeAdTrack) {
        homeAdSection.style.display = "block";
        homeAdTrack.innerHTML = "";
        
        homeAds.forEach(ad => {
          const slide = document.createElement("div");
          slide.className = "ad-slide";
          
          let imageHtml = "";
          if (ad.posterUrl) {
            imageHtml = `<div class="ad-image-left"><img src="${ad.posterUrl}" alt="Sponsor Poster" /></div>`;
          } else {
            imageHtml = `<div class="ad-image-left" style="background: linear-gradient(135deg, #06b6d4, #7c3aed)"></div>`;
          }
          
          slide.innerHTML = `
            ${imageHtml}
            <div class="ad-info-right">
              <div class="ad-banner-label">Sponsored Partnership</div>
              <div class="ad-text-content">
                <div class="ad-logo">🚀 ${ad.sponsorName}</div>
                <div class="ad-text">
                  <h4>${ad.title}</h4>
                  <p>${ad.description}</p>
                </div>
              </div>
              <a href="${ad.link || '#'}" target="_blank" class="btn-ad-cta">Claim Offer</a>
            </div>
          `;
          homeAdTrack.appendChild(slide);
        });
        
        if (homeAds.length > 1) {
          let currentIndex = 0;
          homeCarouselInterval = setInterval(() => {
            currentIndex = (currentIndex + 1) % homeAds.length;
            homeAdTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
          }, 5000);
        } else {
          homeAdTrack.style.transform = `translateX(0%)`;
        }
      } else if (homeAdSection) {
        homeAdSection.style.display = "none";
      }

      // 2. Login sidebar ad placement (Carousel)
      const loginAds = ads.filter(ad => ad.placement === "login_sidebar");
      const authBrandDefault = document.getElementById("authBrandDefault");
      const authAdCampaign = document.getElementById("authAdCampaign");
      const authAdTrack = document.getElementById("authAdTrack");
      
      if (loginCarouselInterval) clearInterval(loginCarouselInterval);

      if (loginAds.length > 0 && authBrandDefault && authAdCampaign && authAdTrack) {
        authBrandDefault.style.display = "none";
        authAdCampaign.style.display = "block";
        authAdTrack.innerHTML = "";

        loginAds.forEach(ad => {
          const slide = document.createElement("div");
          slide.style.cssText = "flex: 0 0 100%; width:100%; height:100%; display:flex; flex-direction:column; background:#f0fdf4; position:relative;";
          
          let posterHtml = "";
          if (ad.posterUrl) {
            posterHtml = `
              <div style="flex:1; width:100%; position:relative; overflow:hidden; min-height: 200px; background: #f0fdf4; display:flex; align-items:center; justify-content:center;">
                <img src="${ad.posterUrl}" alt="Sponsor Poster" style="width:100%; height:100%; object-fit:contain; display:block; padding:0.5rem;" />
                <div style="position:absolute; bottom:0; left:0; right:0; height:40px; background:linear-gradient(to bottom, transparent, #f0fdf4);"></div>
              </div>
            `;
          } else {
            posterHtml = `
              <div style="flex:1; width:100%; position:relative; overflow:hidden; min-height: 200px; background: linear-gradient(135deg, #06b6d4, #7c3aed);">
                <div style="position:absolute; bottom:0; left:0; right:0; height:40px; background:linear-gradient(to bottom, transparent, #f0fdf4);"></div>
              </div>
            `;
          }

          slide.innerHTML = `
            ${posterHtml}
            <div style="padding:2rem; display:flex; flex-direction:column; justify-content:center; background:#f0fdf4;">
              <div class="badge-premium" style="background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.4); color:var(--accent); margin-bottom:1rem; width:fit-content;">Sponsor Spotlight</div>
              <h1 style="font-size:1.8rem; line-height:1.2; margin-bottom:0.7rem; color:var(--text);">${ad.title}</h1>
              <p style="color:var(--muted); line-height:1.6; margin-bottom:1.5rem; font-size:0.95rem;">${ad.description}</p>
              
              <div style="display:flex; justify-content:space-between; align-items:center; gap: 1rem; flex-wrap: wrap;">
                <div class="ad-logo" style="width:fit-content; font-size:1rem; margin:0;">🚀 ${ad.sponsorName}</div>
                <a href="${ad.link || '#'}" target="_blank" class="btn-ad-cta" style="display:inline-block; text-align:center;">Claim Offer</a>
              </div>
            </div>
          `;
          authAdTrack.appendChild(slide);
        });

        if (loginAds.length > 1) {
          let currentLoginIndex = 0;
          loginCarouselInterval = setInterval(() => {
            currentLoginIndex = (currentLoginIndex + 1) % loginAds.length;
            authAdTrack.style.transform = `translateX(-${currentLoginIndex * 100}%)`;
          }, 5000);
        } else {
          authAdTrack.style.transform = `translateX(0%)`;
        }
      } else if (authBrandDefault && authAdCampaign) {
        authBrandDefault.style.display = "block";
        authAdCampaign.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Failed to load sponsored campaigns:", err);
  }
}

// TOGGLE ADMIN SECRET CODE FIELD
function toggleAdminCodeField() {
  const isChecked = document.getElementById("regIsAdmin").checked;
  const codeGroup = document.getElementById("adminCodeGroup");
  if (codeGroup) codeGroup.style.display = isChecked ? "block" : "none";
  if (!isChecked) {
    const codeInput = document.getElementById("regAdminCode");
    if (codeInput) codeInput.value = "";
  }
}

// AUTHENTICATION LOGIC
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById("registerBtn");
  btn.disabled = true;
  btn.querySelector("span").textContent = "Creating Account...";

  const body = {
    name:     document.getElementById("regName").value.trim(),
    email:    document.getElementById("regEmail").value.trim(),
    password: document.getElementById("regPassword").value,
    college:  document.getElementById("regCollege").value.trim(),
    collegePincode: document.getElementById("regCollegePincode").value.trim(),
    role:     document.getElementById("regIsAdmin").checked ? "admin" : "student",
    adminSecretCode: (document.getElementById("regAdminCode") || {}).value || ""
  };

  try {
    const res  = await fetch(`${API}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      showMsg("registerMsg", "✅ Account created! Switching to login...", "success");
      document.getElementById("registerForm").reset();
      document.getElementById("fileName").textContent = "Choose PDF file...";
      setTimeout(() => switchTab("login"), 1500);
    } else {
      showMsg("registerMsg", "❌ " + data.message, "error");
    }
  } catch {
    showMsg("registerMsg", "❌ Cannot reach server. Is backend running?", "error");
  }
  btn.disabled = false;
  btn.querySelector("span").textContent = "Create Account";
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.querySelector("span").textContent = "Logging in...";

  const body = {
    email:    document.getElementById("loginEmail").value.trim(),
    password: document.getElementById("loginPassword").value
  };

  try {
    const res  = await fetch(`${API}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("sb_token", data.token);
      localStorage.setItem("sb_user", JSON.stringify(data.user));
      showMsg("loginMsg", "✅ Login successful!", "success");
      document.getElementById("loginForm").reset();
      setTimeout(() => showDashboard(data.user), 600);
    } else {
      showMsg("loginMsg", "❌ " + data.message, "error");
    }
  } catch (error) {
    showMsg("loginMsg", "❌ Cannot reach server. Is backend running?", "error");
  }
  btn.disabled = false;
  btn.querySelector("span").textContent = "Login to StudyBin";
}

function logout() {
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_user");
  localStorage.removeItem("cm_token");
  localStorage.removeItem("cm_user");
  showLandingPage();
}

function goToAdminHub() {
  window.location.href = "admin.html";
}

function showDashboard(user) {
  if (user.role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  document.getElementById("landingPage").style.display = "none";
  document.getElementById("authSection").style.display = "none";
  document.getElementById("dashboard").style.display   = "block";
  
  document.getElementById("loginNavBtn").style.display = "none";
  document.getElementById("logoutBtn").style.display   = "inline-block";
  
  // Set User Details
  document.getElementById("userName").textContent        = user.name.split(" ")[0];
  document.getElementById("userCollege").textContent     = "🏫 " + user.college + " (Security Verified)";
  document.getElementById("navCollege").style.display    = "inline-block";
  document.getElementById("navCollege").textContent      = user.college;
  document.getElementById("navCollege").onclick          = null;
  document.getElementById("navCollege").style.cursor     = "default";
  document.getElementById("notesCollegeName").textContent = user.college;
  document.getElementById("userAvatar").textContent      = user.name.charAt(0).toUpperCase();

  document.getElementById("adminToggleBtn").style.display = "none";

  // Always reload ads fresh when dashboard loads
  loadPublicAds();
  loadNotes();
}

// NOTES RETRIEVAL & RENDERING (WITH ADVERTISEMENTS SPOTS)
async function loadNotes() {
  const user  = getUser();
  const token = getToken();
  if (!user || !token) return;

  document.getElementById("notesGrid").innerHTML         = "";
  document.getElementById("emptyState").style.display    = "none";
  document.getElementById("loadingState").style.display  = "block";
  document.getElementById("notesCount").textContent      = "";
  document.getElementById("searchInput").value           = "";

  try {
    // 1. Fetch saved notes IDs to know what is pinned
    const savedRes = await fetch(`${API}/users/saved-notes`, {
      headers: { "Authorization": "Bearer " + token }
    });
    if (savedRes.ok) {
      const savedData = await savedRes.json();
      userSavedNotes = savedData.map(n => n._id || n);
    }

    // 2. Fetch college notes
    const res  = await fetch(`${API}/notes/college/${encodeURIComponent(user.college)}`, {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    document.getElementById("loadingState").style.display = "none";

    if (!res.ok || data.length === 0) {
      document.getElementById("emptyState").style.display = "block";
      return;
    }

    allNotes = data;
    renderNotes(data);

  } catch {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("emptyState").style.display   = "block";
  }
}

function searchNotes() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const filtered = allNotes.filter(note =>
    note.title.toLowerCase().includes(query) ||
    (note.subject && note.subject.toLowerCase().includes(query)) ||
    (note.summary && note.summary.toLowerCase().includes(query)) ||
    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
  );
  renderNotes(filtered);
}

function renderNotes(notes) {
  const grid = document.getElementById("notesGrid");
  grid.innerHTML = "";

  document.getElementById("emptyState").style.display = notes.length === 0 ? "block" : "none";
  document.getElementById("notesCount").textContent = notes.length + " study note(s) found";

  const user = getUser();
  const isAdmin = user && user.role === "admin";

  notes.forEach((note, i) => {
    // Generate tags element
    let tagsHtml = "";
    if (note.tags && note.tags.length > 0) {
      tagsHtml = `<div class="note-tags-list">`;
      note.tags.forEach(tag => {
        tagsHtml += `<span class="note-tag-bubble">#${tag.trim()}</span>`;
      });
      tagsHtml += `</div>`;
    }

    const isSaved = userSavedNotes.includes(note._id);

    const card = document.createElement("div");
    card.className = "note-card";
    card.style.animationDelay = (i * 0.06) + "s";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
        <span class="note-subject">${note.subject || "General"}</span>
        <button class="btn-pin ${isSaved ? 'pinned' : ''}" onclick="togglePinNote('${note._id}')" id="pin-btn-${note._id}">
          ${isSaved ? '📌 Saved' : '📍 Save'}
        </button>
      </div>
      <div class="note-title">${note.title}</div>
      <div class="note-desc">${note.description || "No description."}</div>
      
      <!-- AI Generated Summary block -->
      ${note.summary ? `<div class="note-summary-text">✨ <strong>AI Summary:</strong> ${note.summary}</div>` : ""}
      
      <!-- Tags bubbles -->
      ${tagsHtml}
      
      ${note.fileUrl ? `
      <div class="note-actions">
        <button onclick="viewNoteFile('${note.fileUrl}')" class="btn-view">👁 View</button>
        <button onclick="downloadNoteFile('${note.fileUrl}', '${note.title.replace(/'/g, "\\'")}')" class="btn-download" data-url="${note.fileUrl}">📥 Download</button>
      </div>
      ` : ""}
      
      <div class="note-footer">
        <span>👤 ${note.uploadedBy || "Unknown"}</span>
        <!-- Student delete notes restricted: only render delete button for platform admins -->
        ${isAdmin ? `<button class="btn-delete" onclick="deleteNote('${note._id}')">🗑 Delete</button>` : ""}
      </div>
    `;
    grid.appendChild(card);

    // ADVERTISING PLACEMENT SLOT (Every 3rd card — uses real admin-uploaded feed_card ads)
    if ((i + 1) % 3 === 0) {
      const feedAds = loadedAds.filter(ad => ad.placement === "feed_card");
      const feedAd = feedAds.length > 0 ? feedAds[Math.floor(((i + 1) / 3 - 1) % feedAds.length)] : null;

      const adCard = document.createElement("div");
      adCard.className = "note-card sponsored-card";
      if (feedAd) {
        adCard.innerHTML = `
          <span class="sponsor-badge">Sponsored by ${feedAd.sponsorName}</span>
          <div class="note-title" style="color: var(--accent)">🚀 ${feedAd.title}</div>
          <div class="note-desc">${feedAd.description}</div>
          <a href="${feedAd.link || '#'}" target="_blank" class="pdf-link" style="background: rgba(6,182,212,0.15); border-color: var(--accent); color: var(--accent);">Visit Sponsor ↗</a>
          <div class="note-footer"><span>🛡️ Verified Sponsor</span></div>
        `;
      } else {
        // No feed ad created yet — show a subtle placeholder
        adCard.innerHTML = `
          <span class="sponsor-badge">Sponsored Placement</span>
          <div class="note-title" style="color: var(--accent)">🚀 Advertise Here</div>
          <div class="note-desc">This space is available for sponsorship. Contact the platform owner to run your ad campaign here and reach thousands of students.</div>
          <div class="note-footer"><span>📢 Ad Space Available</span></div>
        `;
      }
      grid.appendChild(adCard);
    }
  });
}
// TOGGLE PIN/SAVE NOTE
async function togglePinNote(noteId) {
  const token = getToken();
  if (!token) return;

  const btn = document.getElementById(`pin-btn-${noteId}`);
  if(btn) {
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
  }

  try {
    const res = await fetch(`${API}/users/save-note/${noteId}`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    if (res.ok) {
      if (data.isSaved) {
        userSavedNotes.push(noteId);
        if(btn) {
          btn.classList.add('pinned');
          btn.innerHTML = '📌 Saved';
        }
      } else {
        userSavedNotes = userSavedNotes.filter(id => id !== noteId);
        if(btn) {
          btn.classList.remove('pinned');
          btn.innerHTML = '📍 Save';
        }
        // If we are currently showing saved notes ONLY, remove it from view
        if(showingSavedNotesOnly) {
          showSavedNotesOnly();
        }
      }
    }
  } catch (err) {
    console.error("Error saving note:", err);
  }

  if(btn) {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  }
}

function showSavedNotesOnly() {
  showingSavedNotesOnly = true;
  document.getElementById("notesCollegeName").textContent = "My Saved Notes";
  document.getElementById("notesCount").textContent = "";
  
  const saved = allNotes.filter(n => userSavedNotes.includes(n._id));
  renderNotes(saved);
}

function showAllNotes() {
  const user = getUser();
  showingSavedNotesOnly = false;
  document.getElementById("notesCollegeName").textContent = user.college;
  renderNotes(allNotes);
}
// VIEW NOTE FILE IN BROWSER
function viewNoteFile(url) {
  if (!url) return;
  // Cloudinary "raw" files download by default.
  // We use Google Docs Viewer to force a preview in the browser.
  const encodedUrl = encodeURIComponent(url);
  const viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}`;
  window.open(viewerUrl, '_blank');
}

// SECURE & EASY DOWNLOAD WITH CORRECT FILE EXTENSIONS
async function downloadNoteFile(url, noteTitle) {
  if (!url) return;
  
  let safeTitle = noteTitle.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_');
  
  let extension = ".pdf";
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.includes(".docx") || lowercaseUrl.endsWith("docx")) {
    extension = ".docx";
  } else if (lowercaseUrl.includes(".doc") || lowercaseUrl.endsWith("doc")) {
    extension = ".doc";
  } else if (lowercaseUrl.includes(".pptx") || lowercaseUrl.endsWith("pptx")) {
    extension = ".pptx";
  } else if (lowercaseUrl.includes(".ppt") || lowercaseUrl.endsWith("ppt")) {
    extension = ".ppt";
  }
  
  const finalFilename = safeTitle + extension;
  const downloadBtns = document.querySelectorAll(`[data-url="${url}"]`);
  
  downloadBtns.forEach(btn => {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "⏳ Downloading...";
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.7";
  });

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("CORS block or fetch error, opening directly:", error);
    window.open(url, '_blank');
  } finally {
    downloadBtns.forEach(btn => {
      btn.textContent = btn.dataset.originalText || "📄 Download Material";
      btn.style.pointerEvents = "auto";
      btn.style.opacity = "1";
    });
  }
}

// STUDENT NOTE DELETION (ONLY PERMITTED FOR ADMINS AT API LEVEL AS WELL)
async function deleteNote(noteId) {
  if (!confirm("Are you sure you want to delete this note? This action is permanent!")) return;
  const token = getToken();
  try {
    const res = await fetch(`${API}/notes/${noteId}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await res.json();
    if (res.ok) {
      loadNotes();
      // If admin panel is open, reload admin notes too
      if (document.getElementById("adminPanel").style.display === "block") {
        loadAdminStats();
      }
    } else {
      alert(data.message || "Failed to delete note!");
    }
  } catch {
    alert("Server error!");
  }
}

function toggleAddNote() {
  const card = document.getElementById("addNoteCard");
  card.style.display = card.style.display === "none" ? "block" : "none";
}

// AI SUMMARIZER COMPANION INTERACTION
async function generateAiSummary() {
  const title = document.getElementById("noteTitle").value.trim();
  const subject = document.getElementById("noteSubject").value.trim();
  const description = document.getElementById("noteDesc").value.trim();

  if (!title) {
    alert("Please enter a Note Title first to help AI analyze the material!");
    return;
  }

  const token = getToken();
  const btn = document.getElementById("btnAiGenerate");
  const loading = document.getElementById("aiGenLoading");

  btn.disabled = true;
  loading.style.display = "flex";

  try {
    const res = await fetch(`${API}/ai/summarize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ title, subject, description })
    });
    const data = await res.json();
    
    if (res.ok) {
      document.getElementById("noteSummary").value = data.summary;
      document.getElementById("noteTags").value = data.tags.join(", ");
      currentNoteIsFlagged = data.is_flagged || false;
      currentNoteFlagReason = data.flag_reason || "";
    } else {
      alert("AI Summary failed: " + (data.error || "Internal error"));
    }
  } catch {
    alert("Could not reach AI summarization service.");
  }
  btn.disabled = false;
  loading.style.display = "none";
}

// ADD NOTE SUBMISSION
async function handleAddNote(e) {
  e.preventDefault();
  const token = getToken();
  const user  = getUser();

  const formData = new FormData();
  formData.append("title",       document.getElementById("noteTitle").value.trim());
  formData.append("subject",     document.getElementById("noteSubject").value.trim());
  formData.append("description", document.getElementById("noteDesc").value.trim());
  formData.append("summary",     document.getElementById("noteSummary").value.trim());
  
  // Format tags array
  const tagsVal = document.getElementById("noteTags").value;
  const tagsArr = tagsVal ? tagsVal.split(",").map(t => t.trim()).filter(t => t.length > 0) : [];
  tagsArr.forEach(t => formData.append("tags[]", t));

  formData.append("college",     user.college);
  formData.append("uploadedBy",  user.name);
  formData.append("is_flagged",  currentNoteIsFlagged ? 1 : 0);
  formData.append("flag_reason", currentNoteFlagReason);

  const file = document.getElementById("noteFile").files[0];
  if (file) formData.append("file", file);

  try {
    const res  = await fetch(`${API}/notes/add`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token },
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      showMsg("addNoteMsg", "✅ Note added successfully!", "success");
      document.getElementById("addNoteForm").reset();
      document.getElementById("fileName").textContent = "Choose PDF file...";
      currentNoteIsFlagged = false;
      currentNoteFlagReason = "";
      setTimeout(() => { 
        toggleAddNote(); 
        loadNotes(); 
        showMsg("addNoteMsg","",""); 
      }, 1000);
    } else {
      showMsg("addNoteMsg", "❌ " + (data.message || data.error), "error");
    }
  } catch {
    showMsg("addNoteMsg", "❌ Server error. Try again.", "error");
  }
}

// FLOATING AI CHATBOT INTERACTION
function toggleChatbot() {
  const windowEl = document.getElementById("chatboxWindow");
  windowEl.style.display = windowEl.style.display === "none" ? "flex" : "none";
}

async function sendChatPrompt(promptText) {
  document.getElementById("chatInput").value = promptText;
  const form = document.querySelector(".chatbox-input");
  const event = new Event('submit', { cancelable: true });
  form.dispatchEvent(event);
  handleChatSubmit(event);
}

async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  
  const inputEl = document.getElementById("chatInput");
  const message = inputEl.value.trim();
  if (!message) return;

  inputEl.value = "";

  // Append user message
  appendChatMessage(message, "user");

  // Show typing bubble placeholder
  const loadingId = appendChatMessage("Typing...", "bot loading-dots");

  const token = getToken();
  try {
    const res = await fetch(`${API}/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    
    // Remove loading dots bubble
    const loadingBubble = document.getElementById(loadingId);
    if (loadingBubble) loadingBubble.remove();

    if (res.ok) {
      appendChatMessage(data.reply, "bot");
    } else {
      appendChatMessage("Sorry, I encountered an issue. " + (data.error || ""), "bot");
    }
  } catch {
    const loadingBubble = document.getElementById(loadingId);
    if (loadingBubble) loadingBubble.remove();
    appendChatMessage("Could not reach study assistant service. Please check your internet connection.", "bot");
  }
}

function appendChatMessage(text, senderClass) {
  const container = document.getElementById("chatMessages");
  const msgDiv = document.createElement("div");
  const id = "msg-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  
  msgDiv.id = id;
  msgDiv.className = "chat-msg " + senderClass;
  msgDiv.innerHTML = `<p>${text}</p>`;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  return id;
}

// REDIRECT TO SPECIAL ADMIN PAGE
function goToAdminHub() {
  transitionToPage('admin.html');
}

// ============================================================
// PAGE TRANSITION LOADER — shows logo animation for 2 seconds
// ============================================================
function transitionToPage(url) {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('active');
    setTimeout(() => {
      window.location.href = url;
    }, 2500);
  } else {
    window.location.href = url;
  }
}

function showPageLoader(callback) {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('active');
    setTimeout(() => {
      loader.classList.remove('active');
      if (callback) callback();
    }, 2000);
  } else {
    if (callback) callback();
  }
}