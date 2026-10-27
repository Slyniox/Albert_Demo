import { renderMarkdown } from "./markdown.js?v=20261013-ux2";

const iconMarkup = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4.2-.8L19 8.4 15.6 5 4.8 15.8 4 20Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.8-2L20 9M4 15l2.6 2a7 7 0 0 0 11.8-2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  conversation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.4-3.1A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h7"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5m0 3h.01"/><circle cx="12" cy="12" r="9"/></svg>',
};

function setIcon(element, name) {
  element.innerHTML = iconMarkup[name] || "";
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Local HTTP origins and older browsers can deny Clipboard API access.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function showActionFeedback(button, text) {
  const originalLabel = button.dataset.originalLabel || button.getAttribute("aria-label") || "Copy";
  const originalTitle = button.dataset.originalTitle || button.title || originalLabel;
  button.dataset.originalLabel = originalLabel;
  button.dataset.originalTitle = originalTitle;
  button.setAttribute("aria-label", text);
  button.title = text;
  button.classList.add("is-confirmed");
  setIcon(button, "check");

  window.setTimeout(() => {
    button.setAttribute("aria-label", originalLabel);
    button.title = originalTitle;
    button.classList.remove("is-confirmed");
    setIcon(button, button.dataset.actionIcon || "copy");
  }, 1400);
}

export class ChatUI {
  constructor() {
    this.content = document.getElementById("chat-content");
    this.scroll = document.getElementById("chat-scroll");
    this.title = document.getElementById("conversation-title");
    this.history = document.getElementById("conversation-list");
    this.input = document.getElementById("message-input");
    this.sendButton = document.getElementById("send-button");
    this.sidebar = document.getElementById("sidebar");
    this.backdrop = document.getElementById("sidebar-backdrop");
    this.shell = document.querySelector(".app-shell");
    this.sidebarToggle = document.getElementById("open-sidebar");
    this.sidebarQuery = window.matchMedia("(max-width: 760px)");
    this.sidebarQuery.addEventListener("change", () => {
      this.sidebar.classList.remove("open");
      this.backdrop.classList.remove("visible");
      this.syncSidebarState();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && this.sidebarQuery.matches && this.sidebar.classList.contains("open")) {
        this.closeSidebar();
      }
    });
    this.syncSidebarState();

    // Follow live output until the user scrolls away. Once detached,
    // streaming/status updates never pull the viewport back down.
    this.autoFollow = true;
    this.jumpButton = document.getElementById("jump-to-latest");

    this.scroll.addEventListener("scroll", () => {
      if (this.isNearBottom(140)) {
        this.autoFollow = true;
        this.hideJumpButton();
      } else {
        this.autoFollow = false;
        this.showJumpButton();
      }
    }, { passive: true });

    this.jumpButton?.addEventListener("click", () => {
      this.autoFollow = true;
      this.scrollToBottom(true);
      this.hideJumpButton();
    });
  }

  setTitle(title) {
    this.title.textContent = title;
  }

  showWelcome(show) {
    if (show) {
      this.content.innerHTML = `
        <section class="welcome" id="welcome">
          <div class="orb"><div class="orb-core">A</div></div>
          <h1>Good to see you.</h1>
          <p>Ask Albert anything. Your conversation stays on your local system.</p>
          <button class="welcome-voice-button" data-open-voice type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Zm6-3.5a1 1 0 0 0-2 0 4 4 0 0 1-8 0 1 1 0 0 0-2 0 6 6 0 0 0 5 5.91V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.09A6 6 0 0 0 18 11Z"/></svg>
            <span>Try voice mode</span>
          </button>
          <div class="suggestions">
            <button type="button" data-prompt="Search my diary">Search my diary</button>
            <button type="button" data-prompt="Search the web">Search the web</button>
          </div>
        </section>
      `;
    }
  }

  clearMessages() {
    this.content.innerHTML = "";
  }

  createActivity() {
    const block = document.createElement("details");
    block.className = "activity-block";
    block.open = true;

    const summary = document.createElement("summary");
    summary.className = "activity-summary";

    const icon = document.createElement("span");
    icon.className = "activity-icon";
    setIcon(icon, "sparkle");

    const summaryText = document.createElement("span");
    summaryText.className = "activity-summary-text";
    summaryText.textContent = "Working on your request";

    const chevron = document.createElement("span");
    chevron.className = "activity-chevron";
    setIcon(chevron, "chevron");

    summary.append(icon, summaryText, chevron);

    const timeline = document.createElement("div");
    timeline.className = "activity-timeline";

    block.append(summary, timeline);
    this.content.appendChild(block);
    this.scrollToBottom();

    const labels = {
      planning: "Planning",
      diary: "Searching your diary",
      web: "Searching the web",
      reranking: "Reviewing results",
      thinking: "Thinking",
      generating: "Generating response",
    };

    const entries = new Map();
    const startedAt = performance.now();

    const formatDuration = (ms) => {
      const seconds = ms / 1000;
      if (seconds < 1) return "<1s";
      return `${seconds.toFixed(1)}s`;
    };

    const updateSummary = () => {
      const active = [...entries.values()].find(entry => entry.state === "started");
      summaryText.textContent = active
        ? active.label
        : `Worked for ${formatDuration(performance.now() - startedAt)}`;
    };

    const renderEntry = (event) => {
      if (!event?.stage) return;

      let entry = entries.get(event.stage);
      if (!entry) {
        const row = document.createElement("div");
        row.className = "activity-entry";

        const marker = document.createElement("span");
        marker.className = "activity-entry-marker";

        const body = document.createElement("div");
        body.className = "activity-entry-body";

        const label = document.createElement("div");
        label.className = "activity-entry-label";

        const detail = document.createElement("div");
        detail.className = "activity-entry-detail";

        body.append(label, detail);
        row.append(marker, body);
        timeline.appendChild(row);

        entry = { row, marker, label, detail, labelText: labels[event.stage] || event.stage, state: event.state };
        entries.set(event.stage, entry);
      }

      entry.state = event.state;
      entry.label.textContent = entry.labelText;
      entry.row.classList.toggle("started", event.state === "started");
      entry.row.classList.toggle("completed", event.state === "completed");
      entry.row.classList.toggle("failed", event.state === "failed");
      if (event.state === "completed") setIcon(entry.marker, "check");
      else if (event.state === "failed") setIcon(entry.marker, "error");
      else entry.marker.innerHTML = '<span class="activity-pulse-dot"></span>';

      if (event.detail) {
        entry.detail.textContent = event.detail;
        entry.detail.hidden = false;
      } else {
        entry.detail.textContent = "";
        entry.detail.hidden = true;
      }

      updateSummary();
      this.scrollToBottom();
    };

    return {
      update: renderEntry,
      finish: () => {
        for (const entry of entries.values()) {
          if (entry.state === "started") {
            entry.state = "completed";
            setIcon(entry.marker, "check");
            entry.row.classList.remove("started");
            entry.row.classList.add("completed");
          }
        }
        updateSummary();
        block.open = false;
        this.scrollToBottom();
      },
      fail: (detail) => {
        if (detail) {
          const row = document.createElement("div");
          row.className = "activity-entry failed";
          const marker = document.createElement("span");
          marker.className = "activity-entry-marker";
          setIcon(marker, "error");
          const body = document.createElement("div");
          body.className = "activity-entry-body";
          const label = document.createElement("div");
          label.className = "activity-entry-label";
          label.textContent = "Request failed";
          const detailNode = document.createElement("div");
          detailNode.className = "activity-entry-detail";
          detailNode.textContent = detail;
          body.append(label, detailNode);
          row.append(marker, body);
          timeline.appendChild(row);
        }
        summaryText.textContent = "Something went wrong";
        block.open = true;
        this.scrollToBottom();
      },
      getElement: () => block,
    };
  }

  insertActivityBefore(activity, element) {
    if (!activity || !element) return;
    this.content.insertBefore(activity.getElement(), element);
    this.scrollToBottom();
  }

  addMessage(role, text = "", options = {}) {
    this.showWelcome(false);

    const row = document.createElement("div");
    row.className = `message-row ${role}`;
    if (options.messageId) row.dataset.messageId = options.messageId;

    const message = document.createElement("article");
    message.className = `message ${role}`;

    const header = document.createElement("div");
    header.className = "message-header";

    const roleLabel = document.createElement("div");
    roleLabel.className = "message-role";
    roleLabel.textContent = role === "user" ? "YOU" : "ALBERT";

    const actions = document.createElement("div");
    actions.className = "message-actions";

    if (role === "user") {
      const editButton = document.createElement("button");
      editButton.className = "message-action";
      editButton.type = "button";
      editButton.dataset.editMessage = options.messageId || "";
      editButton.setAttribute("aria-label", "Edit message");
      editButton.title = "Edit message";
      setIcon(editButton, "edit");
      actions.appendChild(editButton);
    }

    if (role === "assistant") {
      const regenerateButton = document.createElement("button");
      regenerateButton.className = "message-action";
      regenerateButton.type = "button";
      regenerateButton.dataset.regenerateMessage = options.messageId || "";
      regenerateButton.setAttribute("aria-label", "Regenerate response");
      regenerateButton.title = "Regenerate response";
      setIcon(regenerateButton, "refresh");
      actions.appendChild(regenerateButton);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "message-action";
    deleteButton.type = "button";
    deleteButton.dataset.deleteMessage = options.messageId || "";
    deleteButton.setAttribute("aria-label", "Delete message");
    deleteButton.title = "Delete message";
    setIcon(deleteButton, "trash");

    actions.appendChild(deleteButton);
    header.append(roleLabel, actions);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (options.streaming) {
      bubble.classList.add("streaming");
      bubble.textContent = text;
    } else {
      this.renderMessageContent(bubble, text);
    }

    bubble.dataset.rawText = text;

    const utilities = document.createElement("div");
    utilities.className = "message-utilities";

    const copyButton = document.createElement("button");
    copyButton.className = "message-copy-button";
    copyButton.type = "button";
    copyButton.dataset.actionIcon = "copy";
    copyButton.setAttribute("aria-label", "Copy message");
    copyButton.title = "Copy message";
    setIcon(copyButton, "copy");
    copyButton.addEventListener("click", async () => {
      if (await copyText(bubble.dataset.rawText || "")) {
        showActionFeedback(copyButton, "Copied");
      }
    });

    utilities.appendChild(copyButton);
    message.append(header, bubble, utilities);
    row.appendChild(message);
    this.content.appendChild(row);
    this.scrollToBottom(true);

    return {
      row,
      bubble,
      setText: (value) => {
        bubble.dataset.rawText = value;
        if (options.streaming) {
          // Streaming deliberately stays cheap: render only when the browser
          // paints, while preserving Markdown-safe output.
          this.renderMessageContent(bubble, value);
          bubble.classList.add("streaming");
        } else {
          this.renderMessageContent(bubble, value);
        }
        this.scrollToBottom();
      },
      finish: (finalText = null) => {
        bubble.classList.remove("streaming");
        if (finalText !== null) {
          bubble.dataset.rawText = finalText;
          this.renderMessageContent(bubble, finalText);
        }
      },
      getText: () => bubble.dataset.rawText || "",
      error: (value) => {
        bubble.textContent = value;
        bubble.dataset.rawText = value;
        bubble.classList.add("message-error");
        bubble.classList.remove("streaming");
      },
    };
  }

  renderMessageContent(bubble, value) {
    bubble.innerHTML = renderMarkdown(value);
    this.enhanceCodeBlocks(bubble);
  }

  enhanceCodeBlocks(bubble) {
    for (const block of bubble.querySelectorAll(".code-block")) {
      const code = block.querySelector("code")?.textContent || "";
      const copyButton = block.querySelector("[data-copy-code]");
      const downloadButton = block.querySelector("[data-download-code]");
      const toggleButton = block.querySelector("[data-toggle-code]");
      const toggleLabel = block.querySelector(".code-collapse-label");

      if (copyButton) {
        copyButton.dataset.actionIcon = "copy";
        setIcon(copyButton, "copy");
        copyButton.addEventListener("click", async () => {
          if (await copyText(code)) showActionFeedback(copyButton, "Copied");
        });
      }

      if (downloadButton) {
        downloadButton.dataset.actionIcon = "download";
        setIcon(downloadButton, "download");
        downloadButton.addEventListener("click", () => {
          const file = new Blob([code], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(file);
          const link = document.createElement("a");
          link.href = url;
          link.download = "albert-code.html";
          link.hidden = true;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
      }

      toggleButton?.addEventListener("click", () => {
        const collapsed = block.classList.toggle("is-collapsed");
        toggleButton.setAttribute("aria-expanded", String(!collapsed));
        toggleButton.title = collapsed ? "Expand code" : "Collapse code";
        if (toggleLabel) toggleLabel.textContent = collapsed ? "Expand" : "Collapse";
      });
    }
  }

  renderHistory(conversations, activeId) {
    this.history.innerHTML = "";

    for (const conversation of conversations) {
      const wrapper = document.createElement("div");
      wrapper.className = `conversation-item-wrapper ${conversation.id === activeId ? "active" : ""}`;

      const button = document.createElement("button");
      button.className = "conversation-item";
      button.type = "button";
      button.dataset.id = conversation.id;

      const icon = document.createElement("span");
      icon.className = "conversation-icon";
      setIcon(icon, "conversation");

      const name = document.createElement("span");
      name.className = "conversation-name";
      name.textContent = conversation.title || "New conversation";

      const deleteButton = document.createElement("button");
      deleteButton.className = "conversation-delete";
      deleteButton.type = "button";
      deleteButton.dataset.deleteConversation = conversation.id;
      deleteButton.setAttribute("aria-label", `Delete ${conversation.title || "conversation"}`);
      deleteButton.title = "Delete conversation";
      setIcon(deleteButton, "trash");

      button.append(icon, name);
      wrapper.append(button, deleteButton);
      this.history.appendChild(wrapper);
    }
  }

  setBusy(busy) {
    // The input remains disabled during generation, while the button remains
    // clickable so it can act as the Stop control.
    this.input.disabled = busy;
    this.sendButton.disabled = false;
    this.sendButton.classList.toggle("generating", busy);
    this.sendButton.setAttribute("aria-label", busy ? "Stop generation" : "Send message");
    this.sendButton.title = busy ? "Stop generation" : "Send message";
    this.input.placeholder = busy ? "Albert is thinking…" : "Message Albert…";
  }

  focusInput() {
    if (!this.input.disabled) this.input.focus();
  }

  isNearBottom(threshold = 140) {
    return this.scroll.scrollHeight - this.scroll.scrollTop - this.scroll.clientHeight <= threshold;
  }

  scrollToBottom(force = false) {
    if (!force && !this.autoFollow) return;

    requestAnimationFrame(() => {
      if (!force && !this.autoFollow) return;
      this.scroll.scrollTop = this.scroll.scrollHeight;
      this.hideJumpButton();
    });
  }

  beginAutoFollow() {
    this.autoFollow = true;
    this.hideJumpButton();
    this.scrollToBottom(true);
  }

  showJumpButton() {
    this.jumpButton?.classList.add("visible");
  }

  hideJumpButton() {
    this.jumpButton?.classList.remove("visible");
  }

  openSidebar() {
    this.sidebar.classList.add("open");
    this.backdrop.classList.add("visible");
    this.syncSidebarState();
    if (this.sidebarQuery.matches) this.sidebar.querySelector(".new-chat-button")?.focus({ preventScroll: true });
  }

  closeSidebar() {
    const restoreFocus = this.sidebarQuery.matches && this.sidebar.contains(document.activeElement);
    this.sidebar.classList.remove("open");
    this.backdrop.classList.remove("visible");
    this.syncSidebarState();
    if (restoreFocus) this.sidebarToggle?.focus({ preventScroll: true });
  }

  toggleSidebar() {
    if (this.sidebarQuery.matches) {
      if (this.sidebar.classList.contains("open")) this.closeSidebar();
      else this.openSidebar();
      return;
    }

    this.shell.classList.toggle("sidebar-collapsed");
    this.syncSidebarState();
  }

  syncSidebarState() {
    const mobile = this.sidebarQuery.matches;
    const expanded = mobile
      ? this.sidebar.classList.contains("open")
      : !this.shell.classList.contains("sidebar-collapsed");
    const label = mobile
      ? (expanded ? "Close menu" : "Open menu")
      : (expanded ? "Collapse sidebar" : "Open sidebar");

    this.sidebarToggle?.setAttribute("aria-expanded", String(expanded));
    this.sidebarToggle?.setAttribute("aria-label", label);
    this.sidebarToggle?.setAttribute("title", label);
    this.sidebar?.setAttribute("aria-hidden", String(!expanded));
    if (this.sidebar) this.sidebar.inert = !expanded;
  }
}
