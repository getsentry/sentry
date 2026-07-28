import {
  type Ref,
  type RefCallback,
  useCallback,
  useState,
  useSyncExternalStore,
} from 'react';

import {useStableMergeRef} from 'sentry/utils/useStableMergeRef';

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  "[tabindex]:not([tabindex='-1'])",
].join(',');

export function useIsInsideInteractiveElement<T extends HTMLElement>(
  ref: Ref<T> | undefined
) {
  const [interactiveElement, setInteractiveElement] = useState<HTMLElement | null>(null);
  const mergeRef = useStableMergeRef(ref);

  const insideInteractiveElementRef: RefCallback<T> = useCallback(element => {
    setInteractiveElement(
      (element?.parentElement?.closest(INTERACTIVE_SELECTOR) as HTMLElement | null) ??
        null
    );
  }, []);

  const isInteractiveElementFocused = useSyncExternalStore(
    useCallback(
      callback => {
        if (!interactiveElement) {
          return () => {};
        }
        const abortController = new AbortController();
        interactiveElement.addEventListener('focus', callback, {
          signal: abortController.signal,
        });
        interactiveElement.addEventListener('blur', callback, {
          signal: abortController.signal,
        });
        return () => {
          abortController.abort();
        };
      },
      [interactiveElement]
    ),
    () => interactiveElement?.matches(':focus') ?? false
  );

  return {
    ref: mergeRef(insideInteractiveElementRef),
    isInsideInteractiveElement: interactiveElement !== null,
    isInteractiveElementFocused,
  };
}
