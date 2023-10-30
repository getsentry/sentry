import {useEffect, useState} from 'react';

const FLAMEGRAPH_DEBUG_MODE_KEY = '__fgdb__';

export function useInternalFlamegraphDebugMode() {
  const [isEnabled, setIsEnabled] = useState(
    sessionStorage.getItem(FLAMEGRAPH_DEBUG_MODE_KEY) === '1'
  );

  useEffect(() => {
    function handleKeyDown(evt: KeyboardEvent) {
      const isCtrlOrMeta = evt.ctrlKey || evt.metaKey;

      if (isCtrlOrMeta && evt.shiftKey && evt.code === 'KeyI') {
        evt.preventDefault();
        setIsEnabled(val => {
          const next = !val;
          if (next) {
            sessionStorage.setItem(FLAMEGRAPH_DEBUG_MODE_KEY, '1');
          } else {
            sessionStorage.removeItem(FLAMEGRAPH_DEBUG_MODE_KEY);
          }
          return next;
        });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return isEnabled;
}
