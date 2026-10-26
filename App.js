el.messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(el.messageInput.value);
  }
});

el.micBtn.addEventListener("click", toggleMic);

el.soundToggleBtn.addEventListener("click", () => {
  state.settings.spokenResponses = !state.settings.spokenResponses;
  if (!state.settings.spokenResponses) window.speechSynthesis?.cancel();
  saveSettings();
  applySettingsToUI();
});

el.stopSpeechChip.addEventListener("click", () => {
  window.speechSynthesis?.cancel();
  el.stopSpeechChip.classList.add("hidden");
  setAssistantState("idle", "STANDBY");
});

el.returnHomeBtn.addEventListener("click", () => {
  el.appShell.classList.remove("chat-active");
  el.conversationSection.classList.add("hidden");
  el.returnHomeBtn.classList.add("hidden");
  setTimeout(() => hologram?.resize(), 50);
});

// Quick Action Chips
el.quickActionsRail.addEventListener("click", (e) => {
  const chip = e.target.closest(".action-chip");
  if (!chip) return;
  const action = chip.dataset.action;

  if (action === "diagnostics") {
    renderDiagnostics();
    el.diagnosticsModal.classList.remove("hidden");
    return;
  }

  const mode = QUICK_ACTION_MODES[action];
  if (!mode) return;

  if (mode.prompt) {
    sendMessage(mode.prompt);
    return;
  }

  state.activeMode = action;
  el.activeModeLabel.textContent = `Mode: ${mode.label}`;
  el.activeModeBar.classList.toggle("hidden", action === "ask");
  el.messageInput.placeholder = mode.placeholder;
  el.messageInput.focus();
});

el.clearModeBtn.addEventListener("click", () => {
  state.activeMode = "ask";
  el.activeModeBar.classList.add("hidden");
  el.messageInput.placeholder = QUICK_ACTION_MODES.ask.placeholder;
});

// Drawer Controls
const closeDrawer = () => {
  el.historyDrawer.classList.add("hidden");
  el.drawerBackdrop.classList.add("hidden");
};
el.menuBtn.addEventListener("click", () => {
  el.historyDrawer.classList.remove("hidden");
  el.drawerBackdrop.classList.remove("hidden");
});
el.closeDrawerBtn.addEventListener("click", closeDrawer);
el.drawerBackdrop.addEventListener("click", closeDrawer);

el.newChatBtn.addEventListener("click", () => {
  state.currentSessionId = null;
  el.messagesContainer.innerHTML = "";
  el.appShell.classList.remove("chat-active");
  el.conversationSection.classList.add("hidden");
  el.returnHomeBtn.classList.add("hidden");
  closeDrawer();
});

el.historyList.addEventListener("click", (e) => {
  const item = e.target.closest(".history-item");
  if (!item) return;
  const session = state.sessions.find((s) => s.id === item.dataset.sessionId);
  if (!session) return;
  state.currentSessionId = session.id;
  el.messagesContainer.innerHTML = "";
  session.messages.forEach((m) => appendMessageToDOM(m.role, m.content));
  renderHistoryList();
  closeDrawer();
});

el.clearHistoryBtn.addEventListener("click", () => {
  state.sessions = [];
  state.currentSessionId = null;
  localStorage.removeItem(STORAGE_KEYS.SESSIONS);
  el.messagesContainer.innerHTML = "";
  renderHistoryList();
  closeDrawer();
});

// Modals
el.settingsBtn.addEventListener("click", () => el.settingsModal.classList.remove("hidden"));
el.openSettingsFromDrawer.addEventListener("click", () => {
  closeDrawer();
  el.settingsModal.classList.remove("hidden");
});
el.openDiagnosticsFromDrawer.addEventListener("click", () => {
  closeDrawer();
  renderDiagnostics();
  el.diagnosticsModal.classList.remove("hidden");
});
el.runDiagnosticsBtn.addEventListener("click", renderDiagnostics);
el.attachBtn.addEventListener("click", () => el.attachModal.classList.remove("hidden"));

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.getElementById(btn.dataset.closeModal)?.classList.add("hidden");
  });
});

// Settings Changes
[
  [el.settingSpokenResponses, "spokenResponses", "checked"],
  [el.settingAutoSendVoice, "autoSendVoice", "checked"],
  [el.settingVoiceSelect, "voiceURI", "value"],
  [el.settingLanguage, "language", "value"],
  [el.settingHologramTheme, "hologramTheme", "value"],
  [el.settingAnimationIntensity, "animationIntensity", "value"],
  [el.settingReducedMotion, "reducedMotion", "checked"],
  [el.settingSaveHistory, "saveHistory", "checked"]
].forEach(([node, key, prop]) => {
  node?.addEventListener("change", () => {
    state.settings[key] = node[prop];
    saveSettings();
    applySettingsToUI();
  });
});

el.purgeStorageBtn.addEventListener("click", () => {
  localStorage.clear();
  location.reload();
});

// File Upload & Presets
el.contextFileInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  el.messageInput.value = `Attached File (${file.name}):\n\`\`\`\n${text.slice(0, 8000)}\n\`\`\`\n\nPlease analyze this file, Sir.`;
  el.attachModal.classList.add("hidden");
});

document.querySelectorAll(".preset-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    el.messageInput.value = `[Protocol: ${btn.textContent.trim()}] `;
    el.attachModal.classList.add("hidden");
    el.messageInput.focus();
  });
});

// Full-screen Voice Mode
el.voiceModeBtn.addEventListener("click", () => {
  state.voiceScreenOpen = true;
  el.voiceScreenOverlay.classList.remove("hidden");
  toggleMic();
});
const closeVoiceScreen = () => {
  state.voiceScreenOpen = false;
  el.voiceScreenOverlay.classList.add("hidden");
  if (state.isListening) recognition?.stop();
};
el.minimizeVoiceScreenBtn.addEventListener("click", closeVoiceScreen);
el.voiceEndBtn.addEventListener("click", closeVoiceScreen);
el.voiceCentralMicBtn.addEventListener("click", toggleMic);