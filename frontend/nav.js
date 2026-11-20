document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  const topbar = document.querySelector(".topbar");
  const mainContent = document.querySelector(".main");
  let sidebarToggleBtn = document.getElementById("sidebarToggleBtn");

  if (!sidebarToggleBtn && topbar) {
    sidebarToggleBtn = document.createElement("button");
    sidebarToggleBtn.type = "button";
    sidebarToggleBtn.id = "sidebarToggleBtn";
    sidebarToggleBtn.className = "sidebar-toggle-btn";
    sidebarToggleBtn.setAttribute("aria-label", "Toggle Navigation");
    sidebarToggleBtn.setAttribute("aria-controls", "sidebar");
    sidebarToggleBtn.setAttribute("aria-expanded", "false");
    sidebarToggleBtn.innerHTML =
      '<i class="fas fa-bars" aria-hidden="true"></i>';

    const heading = topbar.querySelector("h2");
    if (heading) {
      const topbarLeft = document.createElement("div");
      topbarLeft.className = "topbar-left";
      heading.before(topbarLeft);
      topbarLeft.append(sidebarToggleBtn, heading);
    } else {
      topbar.prepend(sidebarToggleBtn);
    }
  }

  if (!sidebarToggleBtn) return;

  let sidebarOverlay = document.getElementById("sidebarOverlay");
  if (!sidebarOverlay) {
    sidebarOverlay = document.createElement("div");
    sidebarOverlay.className = "sidebar-overlay";
    sidebarOverlay.id = "sidebarOverlay";
    document.body.append(sidebarOverlay);
  }

  sidebar.id = sidebar.id || "sidebar";
  sidebarToggleBtn.setAttribute("aria-controls", sidebar.id);
  sidebarToggleBtn.setAttribute("aria-expanded", "false");

  const setMobileSidebarOpen = (isOpen) => {
    sidebar.classList.toggle("mobile-open", isOpen);
    sidebarOverlay.classList.toggle("active", isOpen);
    sidebarToggleBtn.setAttribute("aria-expanded", String(isOpen));
  };

  // Restore saved state on large screens
  if (window.innerWidth >= 768) {
    const savedState = localStorage.getItem("sidebarCollapsed");
    if (savedState === "true") {
      sidebar.classList.add("collapsed");
      if (mainContent) mainContent.classList.add("expanded");
    }
  }

  sidebarToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.innerWidth >= 768) {
      sidebar.classList.toggle("collapsed");
      if (mainContent) {
        mainContent.classList.toggle("expanded");
      }
      localStorage.setItem(
        "sidebarCollapsed",
        sidebar.classList.contains("collapsed"),
      );
      sidebarToggleBtn.setAttribute(
        "aria-expanded",
        String(!sidebar.classList.contains("collapsed")),
      );
    } else {
      setMobileSidebarOpen(!sidebar.classList.contains("mobile-open"));
    }
  });

  sidebarOverlay.addEventListener("click", () => setMobileSidebarOpen(false));

  // Close mobile sidebar when clicking a nav link
  sidebar.querySelectorAll(".nav a, .logout").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 768) {
        setMobileSidebarOpen(false);
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) {
      setMobileSidebarOpen(false);
    } else {
      sidebar.classList.remove("collapsed");
      if (mainContent) mainContent.classList.remove("expanded");
    }
  });
});
