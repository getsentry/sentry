export function renderOnDomReady(renderFn: () => void) {
  if (document.readyState === 'complete') {
    renderFn();
  } else {
    document.addEventListener('DOMContentLoaded', renderFn);
  }
}
