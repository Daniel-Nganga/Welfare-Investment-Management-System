document.addEventListener("DOMContentLoaded", loadMembers);

async function loadMembers() {
  const tableBody = document.getElementById("membersTableBody");
  const profilename = document.getElementById("memberProfileName");
  const memberRole = document.getElementById("memberRole");
  try {
    const allMembersData = await fetch("/api/member/all");
    //const Memberdata = await fetch("/api/member/:id");
    const token = localStorage.getItem("token");

    const payloadBased64 = token.split(".")[1];
    const decodedPayload = atob(payloadBased64);
    const { id } = JSON.parse(decodedPayload);

    // Added your complete backend route path structure /api/members/id/
    const memberResponse = await fetch(`/api/member/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const memberData = await memberResponse.json();
    console.log(memberData);

    // FIXED: Drill down into .user to access the actual profile properties
    profilename.textContent = memberData.user.fullName;
    memberRole.textContent = memberData.user.role;

    const membersdata = await allMembersData.json();
    console.log(membersdata);

    tableBody.innerHTML = "";

    membersdata.members.forEach((member) => {
      const row = document.createElement("tr");

      [
        member.memberNumber,
        member.fullName,
        member.phoneNumber,
        member.role,
        member.status,
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value ?? "";
        row.appendChild(cell);
      });

      tableBody.appendChild(row);
    });
  } catch (error) {
    tableBody.innerHTML = "";

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.textContent = error.message;

    row.appendChild(cell);
    tableBody.appendChild(row);
  }
}
