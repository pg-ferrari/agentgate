(function () {
  "use strict";

  function getEncryptedData() {
    var el = document.getElementById("encrypted-data");
    if (!el) return null;
    var val = el.getAttribute("data-value");
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch (e) {
      return null;
    }
  }

  function getExpiresAt() {
    var el = document.getElementById("expires-at");
    if (!el) return null;
    return el.getAttribute("data-value") || "";
  }

  function getShareId() {
    var el = document.getElementById("share-meta");
    return el ? el.getAttribute("data-id") || "unknown" : "unknown";
  }

  function fileMap(files) {
    var map = {};
    (files || []).forEach(function (f) {
      map[f.title || ""] = f.content || "";
    });
    return map;
  }

  function pickEntry(data) {
    if (data.plan_mdx) return { title: data.title || "plan.mdx", content: data.plan_mdx };
    var files = data.files || [];
    var map = fileMap(files);
    if (data.entry && map[data.entry] != null) return { title: data.entry, content: map[data.entry] };
    var preferred = ["plan.mdx", "plan.md", "README.mdx", "README.md"];
    for (var i = 0; i < preferred.length; i++) {
      if (map[preferred[i]] != null) return { title: preferred[i], content: map[preferred[i]] };
    }
    for (var j = 0; j < files.length; j++) {
      var name = files[j].title || "";
      if (/\.(mdx?|markdown)$/i.test(name)) return files[j];
    }
    return files[0] || { title: "plan", content: "" };
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function renderMarkdown(markdown) {
    if (window.AgentGateMarkdown) return window.AgentGateMarkdown.renderMarkdown(markdown || "");
    if (typeof marked !== "undefined") return marked.parse(markdown || "");
    return "<pre>" + escapeHtml(markdown || "") + "</pre>";
  }

  function attachCodeHighlight(container) {
    if (!container || typeof hljs === "undefined") return;
    var blocks = container.querySelectorAll("pre code");
    for (var i = 0; i < blocks.length; i++) hljs.highlightElement(blocks[i]);
  }

  function renderMermaid(container) {
    if (!container || typeof mermaid === "undefined") return;
    try {
      mermaid.initialize({ startOnLoad: false, theme: window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default" });
      var nodes = container.querySelectorAll(".mermaid");
      if (nodes.length) mermaid.run({ nodes: nodes });
    } catch (e) {
      console.warn("Mermaid render failed", e);
    }
  }

  function createFileTree(files, active, onSelect) {
    var wrap = document.createElement("aside");
    wrap.className = "plan-sidebar";
    var title = document.createElement("h2");
    title.textContent = "Files";
    wrap.appendChild(title);
    var list = document.createElement("ul");
    list.className = "plan-file-tree";
    (files || []).forEach(function (f) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = f.title || "untitled";
      if ((f.title || "") === active) btn.className = "active";
      btn.addEventListener("click", function () { onSelect(f); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function feedbackKey() {
    return "agentgate-plan-feedback-" + getShareId();
  }

  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(feedbackKey()) || "[]"); } catch (e) { return []; }
  }

  function saveFeedback(items) {
    try { localStorage.setItem(feedbackKey(), JSON.stringify(items)); } catch (e) {}
  }

  function createFeedbackPanel(titleText) {
    var aside = document.createElement("aside");
    aside.className = "plan-feedback";
    aside.innerHTML = '<h2>Chat / Feedback</h2><p class="plan-feedback-hint">Local-only notes for now. Copy them back to your agent after review.</p>';

    var list = document.createElement("div");
    list.className = "plan-feedback-list";
    var items = loadFeedback();

    function redraw() {
      list.innerHTML = "";
      items.forEach(function (item, idx) {
        var div = document.createElement("div");
        div.className = "plan-feedback-item";
        div.innerHTML = '<div class="plan-feedback-meta">#' + (idx + 1) + ' · ' + escapeHtml(item.created_at) + '</div><div></div>';
        div.lastChild.textContent = item.text;
        list.appendChild(div);
      });
    }

    var ta = document.createElement("textarea");
    ta.className = "form-input plan-feedback-input";
    ta.placeholder = "Leave feedback, questions, or change requests...";
    ta.rows = 5;

    var actions = document.createElement("div");
    actions.className = "plan-feedback-actions";
    var add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-primary";
    add.textContent = "Add";
    add.addEventListener("click", function () {
      var text = (ta.value || "").trim();
      if (!text) return;
      items.push({ text: text, created_at: new Date().toLocaleString() });
      saveFeedback(items);
      ta.value = "";
      redraw();
    });

    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn";
    copy.textContent = "Copy for agent";
    copy.addEventListener("click", function () {
      var text = "Feedback for visual plan: " + titleText + "\n\n" + items.map(function (item, i) { return (i + 1) + ". " + item.text; }).join("\n");
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      copy.textContent = "Copied";
      setTimeout(function () { copy.textContent = "Copy for agent"; }, 1200);
    });

    actions.appendChild(add);
    actions.appendChild(copy);
    aside.appendChild(list);
    aside.appendChild(ta);
    aside.appendChild(actions);
    redraw();
    return aside;
  }

  function renderPlanViewer(data, expiresAt) {
    var app = document.getElementById("app");
    if (!app) return;

    var files = data.files || [];
    var entry = pickEntry(data);
    var titleText = data.title || entry.title || "Visual plan";

    var viewer = document.createElement("div");
    viewer.className = "plan-viewer";

    var headerEl = document.createElement("header");
    headerEl.className = "file-viewer-header";

    var headerLeft = document.createElement("div");
    headerLeft.style.display = "flex";
    headerLeft.style.alignItems = "center";
    headerLeft.style.gap = "0.75rem";

    var label = document.createElement("span");
    label.textContent = "visual plan — " + titleText;
    headerLeft.appendChild(label);

    var meta = window.AgentGateExpiry ? window.AgentGateExpiry.getShareMeta() : null;
    var badgeHandle = window.AgentGateExpiry ? window.AgentGateExpiry.createExpiryBadge(expiresAt, meta && meta.neverExpires) : null;
    if (badgeHandle) headerLeft.appendChild(badgeHandle.node);

    var headerRight = document.createElement("div");
    headerRight.style.flexShrink = "0";
    headerRight.style.display = "flex";
    headerRight.style.alignItems = "center";
    headerRight.style.gap = "0.75rem";

    if (badgeHandle && meta && window.AgentGateExpiry) {
      var toggle = window.AgentGateExpiry.createOwnerToggle(meta, badgeHandle);
      if (toggle) headerRight.appendChild(toggle);
    }
    if (window.AgentGateSettings) window.AgentGateSettings.renderSettingsPanel(headerRight);

    headerEl.appendChild(headerLeft);
    headerEl.appendChild(headerRight);
    viewer.appendChild(headerEl);

    var body = document.createElement("div");
    body.className = "plan-layout";

    var article = document.createElement("article");
    article.className = "markdown-body plan-document";

    function renderFile(file) {
      entry = file;
      article.innerHTML = renderMarkdown(file.content || "");
      attachCodeHighlight(article);
      renderMermaid(article);
      var buttons = body.querySelectorAll(".plan-file-tree button");
      for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle("active", buttons[i].textContent === file.title);
    }

    if (files.length > 1) body.appendChild(createFileTree(files, entry.title, renderFile));
    body.appendChild(article);
    body.appendChild(createFeedbackPanel(titleText));
    viewer.appendChild(body);

    app.innerHTML = "";
    app.appendChild(viewer);
    renderFile(entry);
  }

  function attemptDecrypt(passphrase, remember) {
    var encrypted = getEncryptedData();
    if (!encrypted) return;

    var P = window.AgentGatePassphrase;
    if (P) P.showDecryptingState();

    window.AgentGateCrypto
      .decrypt(encrypted.ciphertext, encrypted.iv, encrypted.salt, passphrase)
      .then(function (plaintext) {
        var data = JSON.parse(plaintext);
        if (remember && P) P.storePassphrase(passphrase);
        if (P) P.hidePassphraseDialog();
        renderPlanViewer(data, getExpiresAt());
      })
      .catch(function (err) {
        console.error("Decryption failed:", err);
        if (P) P.updatePassphraseError("Decryption failed. Please check your passphrase.");
      });
  }

  function init() {
    if (window.AgentGateSettings) window.AgentGateSettings.init();
    var encrypted = getEncryptedData();
    if (!encrypted) return;
    var P = window.AgentGatePassphrase;
    if (!P) return;
    var stored = P.getStoredPassphrase();
    if (stored) {
      P.showPassphraseDialog(attemptDecrypt, { isDecrypting: true });
      attemptDecrypt(stored, true);
    } else {
      P.showPassphraseDialog(attemptDecrypt);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
