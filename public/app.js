// Slowgrammers page logic. All scraped data goes into the DOM via textContent;
// links are only set after their URLs pass an allowlist check.

const entriesEl = document.getElementById("entries");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("roster-status");
const template = document.getElementById("entry-template");
const form = document.getElementById("agent-form");
const input = document.getElementById("agent-message");
const submit = document.getElementById("agent-submit");
const counter = document.getElementById("char-count");
const transcript = document.getElementById("transcript");
const statInductees = document.getElementById("stat-inductees");
const statVotes = document.getElementById("stat-votes");

const numberFormat = new Intl.NumberFormat("en");
const dateFormat = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const POST_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"]);

function safePostUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && POST_HOSTS.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function profileUrl(handle) {
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${encodeURIComponent(handle)}` : null;
}

function formatDate(value) {
  if (!value) return "Date unknown";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : `Posted ${dateFormat.format(d)}`;
}

function renderEntries(entries, highlightId) {
  entriesEl.replaceChildren();
  const count = entries.length;
  emptyEl.hidden = count !== 0;
  statusEl.textContent =
    count === 0 ? "Nobody yet." : "Ranked by votes, highest first.";
  statInductees.textContent = numberFormat.format(count);
  statVotes.textContent = numberFormat.format(entries.reduce((sum, e) => sum + (Number(e.votes) || 0), 0));

  entries.forEach((entry, i) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const handle = String(entry.handle ?? "").replace(/^@/, "");

    node.querySelector(".rank-num").textContent = String(i + 1);
    node.querySelector(".plaque-name").textContent = String(entry.display_name ?? handle);

    const handleLink = node.querySelector(".plaque-handle");
    handleLink.textContent = `@${handle}`;
    const profile = profileUrl(handle);
    if (profile) handleLink.href = profile;
    else handleLink.removeAttribute("target");

    const followers = Number(entry.followers) || 0;
    node.querySelector(".plaque-followers").textContent = `${numberFormat.format(followers)} followers`;
    node.querySelector(".plaque-quote p").textContent = String(entry.quote ?? "");
    node.querySelector(".plaque-date").textContent = formatDate(entry.posted_at);

    const postLink = node.querySelector(".plaque-post");
    const post = safePostUrl(entry.post_url);
    if (post) postLink.href = post;
    else postLink.remove();

    const votes = Number(entry.votes) || 0;
    node.querySelector(".votes-num").textContent = numberFormat.format(votes);
    node.querySelector(".votes-label").textContent = votes === 1 ? "vote" : "votes";
    node.querySelector(".medal").setAttribute("aria-label", `${numberFormat.format(votes)} ${votes === 1 ? "vote" : "votes"}`);

    // Voting still goes through the agent: this only drafts the request.
    node.querySelector(".plaque-vote").addEventListener("click", () => {
      input.value = `Please cast my vote for @${handle}.`;
      updateCounter();
      input.focus();
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    if (highlightId !== undefined && entry.id === highlightId) node.classList.add("just-voted");
    entriesEl.append(node);
  });
}

async function loadEntries(highlightId) {
  try {
    const res = await fetch("/api/slowgrammers", { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderEntries(Array.isArray(data) ? data : [], highlightId);
  } catch {
    statusEl.textContent = "Could not load the inductees. Reload the page to try again.";
  }
}

function addLine(kind, who, text) {
  const li = document.createElement("li");
  li.className = kind;
  const label = document.createElement("span");
  label.className = "who";
  label.textContent = who;
  li.append(label, document.createTextNode(text));
  transcript.append(li);
  return li;
}

function updateCounter() {
  counter.textContent = `${input.value.length} / 500`;
}

input.addEventListener("input", updateCounter);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) form.requestSubmit();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  submit.disabled = true;
  addLine("you", "You", message);
  const pending = addLine("agent pending", "Clerk", "Considering your request, reluctantly.");
  input.value = "";
  updateCounter();

  try {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ message }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    pending.remove();

    const reply = typeof data.reply === "string" && data.reply ? data.reply : data.message || "No reply.";
    if (!res.ok && !data.reply) {
      addLine("error", "Error", reply);
    } else if (data.voted) {
      addLine("agent voted", "Clerk", reply);
      await loadEntries(data.voted.entry_id);
    } else {
      addLine(res.ok ? "agent" : "error", "Clerk", reply);
    }
  } catch {
    pending.remove();
    addLine("error", "Error", "Could not reach the agent. Check your connection and try again.");
  } finally {
    submit.disabled = false;
    input.focus();
  }
});

loadEntries();
