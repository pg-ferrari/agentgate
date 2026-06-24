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
    if (window.AgentGateMarkdown) {
      return window.AgentGateMarkdown.renderMarkdown(markdown || "");
    }
    if (typeof marked !== "undefined") {
      return marked.parse(markdown || "");
    }
    return "<pre>" + escapeHtml(markdown || "") + "</pre>";
  }

  function attachCodeHighlight(container) {
    if (!container || typeof hljs === "undefined") return;
    var blocks = container.querySelectorAll("pre code");
    for (var i = 0; i < blocks.length; i++) {
      hljs.highlightElement(blocks[i]);
    }
  }

  function createFileTree(files, entry) {
    var wrap = document.createElement("aside");
    wrap.className = "plan-sidebar";
    var title = document.createElement("h2");
    title.textContent = "Files";
    wrap.appendChild(title);
    var list = document.createElement("ul");
    list.className = "plan-file-tree";
    (files || []).forEach(function (f) {
      var li = document.createElement("li");
      li.textContent = f.title || "untitled";
      if ((f.title || "") === entry) li.className = "active";
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
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
    var badgeHandle = window.AgentGateExpiry
      ? window.AgentGateExpiry.createExpiryBadge(expiresAt, meta && meta.neverExpires)
      : null;
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
    if (window.AgentGateSettings) {
      window.AgentGateSettings.renderSettingsPanel(headerRight);
    }

    headerEl.appendChild(headerLeft);
    headerEl.appendChild(headerRight);
    viewer.appendChild(headerEl);

    var body = document.createElement("div");
    body.className = "plan-layout";
    if (files.length > 1) body.appendChild(createFileTree(files, entry.title));

    var article = document.createElement("article");
    article.className = "markdown-body plan-document";
    article.innerHTML = renderMarkdown(entry.content || "");
    attachCodeHighlight(article);
    body.appendChild(article);
    viewer.appendChild(body);

    app.innerHTML = "";
    app.appendChild(viewer);
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
      // Keep the dialog visible while trying the remembered passphrase. If it
      // belongs to another share, the user can immediately replace it instead
      // of seeing a blank page.
      P.showPassphraseDialog(attemptDecrypt, { isDecrypting: true });
      attemptDecrypt(stored, true);
    } else {
      P.showPassphraseDialog(attemptDecrypt);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
