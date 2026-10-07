// @ts-check
const form = /** @type {HTMLFormElement} */ (document.getElementById('search-form'));
const input = /** @type {HTMLInputElement} */ (document.getElementById('q'));
const button = /** @type {HTMLButtonElement} */ (form.querySelector('button'));
const statusEl = /** @type {HTMLElement} */ (document.getElementById('status'));
const output = /** @type {HTMLElement} */ (document.getElementById('output'));
const list = /** @type {HTMLOListElement} */ (document.getElementById('results'));
const downloadJson = /** @type {HTMLAnchorElement} */ (document.getElementById('download-json'));
const downloadCsv = /** @type {HTMLAnchorElement} */ (document.getElementById('download-csv'));

/** @type {AbortController | null} */
let pending = null;

/**
 * @param {string} message
 * @param {boolean} [isError]
 */
function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

/** @param {{ position: number, title: string, url: string, snippet: string }} r */
function renderResult(r) {
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.href = r.url;
  link.textContent = r.title;
  link.rel = 'noopener noreferrer';
  link.target = '_blank';
  const url = document.createElement('div');
  url.className = 'url';
  url.textContent = r.url;
  const snippet = document.createElement('p');
  snippet.textContent = r.snippet;
  li.append(link, url, snippet);
  return li;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const q = input.value.trim();
  if (!q) return;

  pending?.abort();
  const controller = new AbortController();
  pending = controller;
  button.disabled = true;
  output.hidden = true;
  setStatus('Hľadám…');

  try {
    const params = new URLSearchParams({ q });
    const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Chyba ${res.status}`);

    list.replaceChildren(...body.results.map(renderResult));
    downloadJson.href = `/api/export?${new URLSearchParams({ q: body.query, format: 'json' })}`;
    downloadCsv.href = `/api/export?${new URLSearchParams({ q: body.query, format: 'csv' })}`;
    output.hidden = body.results.length === 0;
    setStatus(
      body.results.length
        ? `Nájdených ${body.results.length} organických výsledkov pre „${body.query}“.`
        : `Pre „${body.query}“ sa nenašli žiadne organické výsledky.`,
    );
  } catch (error) {
    if (controller.signal.aborted) return;
    setStatus(error instanceof Error ? error.message : 'Neznáma chyba.', true);
  } finally {
    if (pending === controller) {
      pending = null;
      button.disabled = false;
    }
  }
});
