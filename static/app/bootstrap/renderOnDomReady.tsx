export function renderOnDomReady(renderFn: () => void) {
  if (document.readyState !== 'loading') {
    renderFn();
  } else {
    document.addEventListener('DOMContentLoaded', renderFn);
  }
}
