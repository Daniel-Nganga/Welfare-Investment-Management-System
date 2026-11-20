// 1. Validate and decode the token
function getValidUser() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(window.atob(base64));

    // Check expiration (only if your token has an 'exp' field)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return null;
    }

    return decoded; // Returns user data (e.g., id, role, email)
  } catch (e) {
    // Clean up corrupted token BEFORE redirecting
    localStorage.removeItem("token");
    return null;
  }
}

async function userprofile() {
  const payload = getValidUser();
  if (!payload) {
    window.location.replace("/index.html");
    return;
  }

  const userId = payload.id || payload._id || payload.userId;
  currentRole = String(payload.role || "").toLowerCase();

  if (!userId) {
    localStorage.removeItem("token");
    window.location.replace("/index.html");
    return;
  }

  try {
    const token = localStorage.getItem("token");

    const response = await fetch(`http://localhost:5000/api/member/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        window.location.replace("/index.html");
        return;
      }
      throw new Error(`HTTP error: ${response.status}`);
    }

    const result = await response.json();
    // Extract result.user to match your getMember controller!
    const member = result.user || result.data || result.member || result;

    const memberNameDisplay = document.getElementById("memberNameDisplay");
    const topbarProfilePicture = document.getElementById(
      "topbarProfilePicture",
    );
    const memberProfileName = document.getElementById("memberProfileName");
    const memberRole = document.getElementById("memberRole");

    if (memberNameDisplay) {
      memberNameDisplay.textContent = member.fullName || "";
    }
    if (topbarProfilePicture) {
      // Cloudinary returns a full https:// URL in member.profilePicture
      topbarProfilePicture.src = member.profilePicture || "default-profile.png";
    }
    if (memberProfileName) {
      memberProfileName.textContent = member.fullName || "";
    }
    if (memberRole) {
      memberRole.textContent = member.role || "";
    }
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
  }
}

// 2. Check access first, then fetch data
async function fetchSystemConfig() {
  const user = getValidUser();
  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  currentRole = String(user.role || "").toLowerCase();
  renderAppFooter();
  userprofile(); // Call userprofile to update the UI with user info

  try {
    const token = localStorage.getItem("token");

    // Pass the token in the Authorization header
    const response = await fetch(
      `http://localhost:5000/api/system-config/settings`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    // Handle backend rejection (e.g., 401 Unauthorized or 403 Forbidden)
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "/index.html";
      }
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Parse the JSON response
    const result = await response.json();
    const config = result.data || result.config || result;

    // Update the UI
    const organizationNameDisplay = document.getElementById(
      "organizationNameDisplay",
    );
    if (organizationNameDisplay && config.organizationName) {
      organizationNameDisplay.textContent = config.organizationName;
      organizationNameDisplay.style.fontWeight = "bold";
      organizationNameDisplay.style.color = "white";
    }

    updateAppFooter(config);
  } catch (error) {
    console.error("Failed to fetch system config:", error);
  }
}

function renderAppFooter() {
  const main = document.querySelector(".main");
  if (!main || main.querySelector(".app-footer")) return;

  const isMemberPortal = currentRole === "member";
  const footer = document.createElement("footer");
  footer.className = `app-footer ${isMemberPortal ? "member-portal-footer" : "admin-portal-footer"}`;
  footer.innerHTML = `
    <div class="app-footer-details">
      <span>© 2026 <span id="footerOrganizationName">Organization</span>${isMemberPortal ? "" : ". All rights reserved."}</span>
      ${
        isMemberPortal
          ? '<span>Financial Year: <span id="footerFinancialYear">FY 2026</span></span>'
          : ""
      }
      <span>${isMemberPortal ? "Need help? " : ""}Support: <span id="footerSupportContact">Contact your administrator</span></span>
    </div>
    <div class="app-footer-credit">System built by <strong>Dcate Tech</strong></div>
  `;
  main.append(footer);
}

function updateAppFooter(config) {
  const organizationName = document.getElementById("footerOrganizationName");
  const financialYear = document.getElementById("footerFinancialYear");
  const supportContact = document.getElementById("footerSupportContact");
  if (organizationName) {
    organizationName.textContent = config.organizationName || "Organization";
  }
  if (financialYear) {
    const configuredYear = String(config.financialYear || "FY 2026").trim();
    financialYear.textContent = /^FY\b/i.test(configuredYear)
      ? configuredYear
      : `FY ${configuredYear}`;
  }
  if (!supportContact) return;

  supportContact.replaceChildren();
  const contacts = [];

  if (config.organizationEmail) {
    const email = document.createElement("a");
    email.href = `mailto:${config.organizationEmail}`;
    email.textContent = config.organizationEmail;
    contacts.push(email);
  }
  if (config.organizationPhone) {
    const phone = document.createElement("a");
    phone.href = `tel:${config.organizationPhone}`;
    phone.textContent = config.organizationPhone;
    contacts.push(phone);
  }

  contacts.forEach((contact, index) => {
    if (index > 0) supportContact.append(" / ");
    supportContact.append(contact);
  });

  if (!contacts.length) {
    supportContact.textContent = "Contact your administrator";
  }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", logoutUser);
}

async function logoutUser() {
  const token = localStorage.getItem("token");

  if (token) {
    try {
      await fetch(`http://localhost:5000/api/auth/member/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error(
        "Backend logout failed, clearing local session anyway:",
        error,
      );
    }
  }

  // Always clear local storage and redirect even if the network request fails
  localStorage.removeItem("token");
  window.location.replace("/index.html");
}

window.addEventListener("pageshow", (event) => {
  // Check if the page was loaded from the Back-Forward cache or if the token is missing
  const user = getValidUser();

  if (event.persisted || !user) {
    // Hide the body immediately so no sensitive data flashes on screen
    document.body.style.display = "none";
    window.location.replace("/index.html");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  fetchSystemConfig();

  if (!document.querySelector('script[src$="table-pagination.js"]')) {
    const paginationScript = document.createElement("script");
    paginationScript.src = "table-pagination.js";
    paginationScript.onerror = () => {
      console.error("Failed to load table pagination.");
    };
    document.body.append(paginationScript);
  }
});
