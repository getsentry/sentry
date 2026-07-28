import {type Ref, type RefCallback, useCallback, useState} from 'react';

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
  const [interactiveElement, setInteractiveElement] = useState<Element | null>(null);
  const mergeRef = useStableMergeRef(ref);

  const insideInteractiveElementRef: RefCallback<T> = useCallback(element => {
    setInteractiveElement(element?.parentElement?.closest(INTERACTIVE_SELECTOR) ?? null);
  }, []);

  return {
    ref: mergeRef(insideInteractiveElementRef),
    isInsideInteractiveElement: interactiveElement !== null,
  };
}
