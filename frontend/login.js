document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    const memberNumber = document.getElementById("memberNumber").value.trim();

    const password = document.getElementById("password").value;
    const message = document.getElementById("loginMessage");

    try {
      const postData = await fetch("/api/member/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ memberNumber, password }),
      });

      if (!postData.ok) {
        throw new Error(`Password or Member Number is incorrect`);
      }

      const data = await postData.json();

      // Save the token and logged-in user
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      message.textContent = "Login successful!";

      // Redirect based on the user's role
      if (data.user.role === "admin") {
        window.location.href = "dashboard.html";
      } else {
        window.location.href = "dashboard.html";
      }
    } catch (error) {
      message.textContent = error.message;
      message.style.color = "red";
    }
  });
