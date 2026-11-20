function initializeTablePagination() {
  document
    .querySelectorAll(
      ".content table:not(.fine-table), .table-card table:not(.fine-table)",
    )
    .forEach(setupTablePagination);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTablePagination, {
    once: true,
  });
} else {
  initializeTablePagination();
}

function setupTablePagination(table) {
  const body = table.tBodies[0];
  if (!body) return;

  const oldPagination = table.nextElementSibling;
  const pagination = document.createElement("div");
  pagination.className = "pagination-container";
  pagination.innerHTML = `
    <div class="pagination-summary" aria-live="polite"></div>
    <label class="rows-per-page-label">
      Rows per page
      <select class="rows-per-page-select" aria-label="Rows per page">
        <option value="10">10</option>
        <option value="25">25</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </label>
    <div class="pagination-controls">
      <button type="button" class="pagination-btn pagination-previous">Previous</button>
      <nav class="pagination-pages" aria-label="Table pages"></nav>
      <button type="button" class="pagination-btn pagination-next">Next</button>
    </div>
  `;

  if (oldPagination?.classList.contains("pagination")) {
    oldPagination.replaceWith(pagination);
  } else {
    table.after(pagination);
  }

  const summary = pagination.querySelector(".pagination-summary");
  const pageSizeSelect = pagination.querySelector(".rows-per-page-select");
  const previousButton = pagination.querySelector(".pagination-previous");
  const nextButton = pagination.querySelector(".pagination-next");
  const pagesContainer = pagination.querySelector(".pagination-pages");
  let page = 1;
  let pageSize = Number(pageSizeSelect.value);

  const render = () => {
    const rows = [...body.rows];
    const emptyRow =
      rows.length === 1 &&
      (rows[0].classList.contains("empty-state") ||
        rows[0].querySelector("td[colspan]"));
    const records = emptyRow ? [] : rows;
    const pageCount = Math.ceil(records.length / pageSize);
    page = Math.min(page, Math.max(pageCount, 1));
    const firstRecord = (page - 1) * pageSize;

    rows.forEach((row, index) => {
      row.hidden =
        !emptyRow && (index < firstRecord || index >= firstRecord + pageSize);
    });

    const start = records.length ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, records.length);
    summary.textContent = `Showing ${start}–${end} of ${records.length}`;

    previousButton.disabled = page <= 1;
    nextButton.disabled = pageCount === 0 || page >= pageCount;
    pagesContainer.replaceChildren();

    const visiblePages = getVisiblePages(page, pageCount);
    visiblePages.forEach((item) => {
      if (item === "…") {
        const ellipsis = document.createElement("span");
        ellipsis.className = "pagination-ellipsis";
        ellipsis.textContent = item;
        pagesContainer.append(ellipsis);
        return;
      }

      const pageButton = document.createElement("button");
      pageButton.type = "button";
      pageButton.className = "pagination-btn";
      pageButton.textContent = String(item);
      pageButton.setAttribute("aria-label", `Page ${item}`);
      pageButton.setAttribute("aria-current", item === page ? "page" : "false");
      pageButton.disabled = pageCount === 0;
      if (item === page) pageButton.classList.add("active");
      pageButton.addEventListener("click", () => {
        page = item;
        render();
      });
      pagesContainer.append(pageButton);
    });
  };

  previousButton.addEventListener("click", () => {
    if (page > 1) {
      page--;
      render();
    }
  });
  nextButton.addEventListener("click", () => {
    page++;
    render();
  });
  pageSizeSelect.addEventListener("change", () => {
    pageSize = Number(pageSizeSelect.value);
    page = 1;
    render();
  });

  const observer = new MutationObserver(() => {
    page = 1;
    render();
  });
  observer.observe(body, { childList: true });

  render();
}

function getVisiblePages(current, pageCount) {
  if (pageCount === 0) return [1];
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(pageCount - 1, current + 1);
  const pages = [1];

  if (start > 2) pages.push("…");
  for (let page = start; page <= end; page++) pages.push(page);
  if (end < pageCount - 1) pages.push("…");
  pages.push(pageCount);
  return pages;
}
