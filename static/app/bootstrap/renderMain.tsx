import {ROOT_ELEMENT} from 'sentry/constants';
import Main from 'sentry/main';

import {renderDom} from './renderDom';

function startMemoryLogging(intervalMs = 5000) {
  if (performance?.memory!) {
    console.log('[MemoryLogger] Starting heap usage logging...');
    setInterval(() => {
      const mem = performance?.memory!;
      console.log(
        `[MemoryLogger] Used JS Heap: ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB / ` +
          `${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB (limit: ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB)`
      );
    }, intervalMs);
  } else {
    console.warn('[MemoryLogger] performance.memory not supported in this browser.');
  }
}

export function renderMain() {
  startMemoryLogging(1000);
  try {
    renderDom(Main, `#${ROOT_ELEMENT}`, {});
  } catch (err) {
    if (err.message === 'URI malformed') {
      // eslint-disable-next-line no-console
      console.error(
        new Error(
          'An unencoded "%" has appeared, it is super effective! (See https://github.com/ReactTraining/history/issues/505)'
        )
      );
      window.location.assign(window.location.pathname);
    }
  }
}
