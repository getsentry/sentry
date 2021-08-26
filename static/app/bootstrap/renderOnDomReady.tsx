let hasEventListener = false;
const queued: Function[] = [];

function onDomContentLoaded() {
  if (!queued.length) {
    return;
  }

  while (queued.length) {
    queued.pop()?.();
  }

  // We can remove this listener immediately since `DOMContentLoaded` should only be fired once
  document.removeEventListener('DOMContentLoaded', onDomContentLoaded);
  hasEventListener = false;
}

export function renderOnDomReady(renderFn: () => void) {
  if (document.readyState !== 'loading') {
    renderFn();
    return;
  }

  queued.push(renderFn);

  if (!hasEventListener) {
    document.addEventListener('DOMContentLoaded', onDomContentLoaded);
    hasEventListener = true;
  }
}
