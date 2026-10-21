import {
  type Ref,
  type RefCallback,
  useCallback,
  useState,
  useSyncExternalStore,
} from 'react';

import {INTERACTIVE_SELECTOR} from '@sentry/scraps/interactiveElement';
import {useStableMergeRef} from '@sentry/scraps/useStableMergeRef';

export function useIsInsideInteractiveElement<T extends HTMLElement>(
  ref: Ref<T> | undefined
) {
  const [interactiveElement, setInteractiveElement] = useState<Element | null>(null);
  const mergeRef = useStableMergeRef(ref);

  const insideInteractiveElementRef: RefCallback<T> = useCallback(element => {
    setInteractiveElement(element?.parentElement?.closest(INTERACTIVE_SELECTOR) ?? null);
  }, []);

  const isInteractiveElementFocusVisible = useSyncExternalStore(
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
    () => interactiveElement?.matches(':focus-visible') ?? false,
    () => false
  );

  return {
    ref: mergeRef(insideInteractiveElementRef),
    isInsideInteractiveElement: interactiveElement !== null,
    isInteractiveElementFocusVisible,
  };
}
