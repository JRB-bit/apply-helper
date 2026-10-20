const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);
const REF = ['company', 'role', 'noteTemplate'];

function updateCount() {
    const n = $('noteTemplate').value.length;
    $('count').textContent = `${n}/200`;
    $('count').classList.toggle('over', n > 200);
}

api.storage.local.get(['profile', 'resume']).then(({ profile = {}, resume }) => {
    for (const id of REF) $(id).value = profile[id] || '';
    updateCount();
    if (resume) $('resumeName').textContent = `Saved: ${resume.name}`;
});

$('noteTemplate').addEventListener('input', updateCount);

$('save').addEventListener('click', async () => {
    const { profile = {} } = await api.storage.local.get('profile');
    for (const id of REF) profile[id] = $(id).value.trim();
    await api.storage.local.set({ profile });
    $('status').textContent = 'Saved';
    setTimeout(() => { $('status').textContent = ''; }, 2000);
});

$('resume').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            await api.storage.local.set({ resume: { name: file.name, type: file.type || 'application/pdf', data: reader.result } });
            $('resumeName').textContent = `Saved: ${file.name}`;
        } catch (err) {
            $('resumeName').textContent = `Couldn't save: ${err.message}`;
        }
    };
    reader.readAsDataURL(file);
});
