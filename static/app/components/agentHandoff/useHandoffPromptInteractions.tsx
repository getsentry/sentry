import {
  useCallback,
  useRef,
  type ClipboardEventHandler,
  type PointerEventHandler,
  type RefObject,
} from 'react';

interface HandoffPromptInteractionProps {
  onCopy: ClipboardEventHandler<HTMLDivElement>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  ref: RefObject<HTMLDivElement | null>;
  tabIndex: -1;
}

/**
 * Selects the masked prompt on primary pointer down and intercepts native copy events
 * so consumers can copy the complete prompt instead of its displayed placeholder.
 */
export function useHandoffPromptInteractions(onCopy: () => void) {
  const promptRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(event => {
    if (event.button !== 0 || !promptRef.current) {
      return;
    }

    promptRef.current.focus({preventScroll: true});
    event.preventDefault();

    const range = document.createRange();
    range.selectNodeContents(promptRef.current);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, []);

  const handleCopy = useCallback<ClipboardEventHandler<HTMLDivElement>>(
    event => {
      event.preventDefault();
      onCopy();
    },
    [onCopy]
  );

  const promptProps: HandoffPromptInteractionProps = {
    onCopy: handleCopy,
    onPointerDown: handlePointerDown,
    ref: promptRef,
    tabIndex: -1,
  };

  return {promptProps};
}
