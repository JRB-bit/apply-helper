// Apply Helper — background
const api = globalThis.browser ?? globalThis.chrome;

// Starter values for the LinkedIn referral note. Change them in the extension's Settings page.
const REFERRAL_DEFAULTS = {
    company: '',
    role: '',
    noteTemplate: "Hi {first}! I just applied to {company}'s {role} and would love to hear about your experience there. Would you be open to referring me? Happy to send my resume. Thank you!",
};

api.runtime.onInstalled.addListener(async () => {
    const { profile } = await api.storage.local.get('profile');
    if (!profile) await api.storage.local.set({ profile: REFERRAL_DEFAULTS });
});

// Keyboard shortcut (Control-Shift-F) fills the current page.
api.commands?.onCommand.addListener(async (command) => {
    if (command !== 'fill-page') return;
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) api.tabs.sendMessage(tab.id, { type: 'fill' }).catch(() => {});
});
