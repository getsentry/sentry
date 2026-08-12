import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';

type SelectionState = {
  rect: DOMRect;
  text: string;
};

function isWithinEditable(node: Node | null) {
  let current = node;
  while (current) {
    if (current instanceof HTMLElement) {
      if (
        current.tagName === 'INPUT' ||
        current.tagName === 'TEXTAREA' ||
        current.isContentEditable
      ) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleMouseUp = () => {
      requestAnimationFrame(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!text || text.length < 3) {
          return;
        }

        if (!sel?.rangeCount) {
          return;
        }

        const range = sel.getRangeAt(0);

        if (!container.contains(range.commonAncestorContainer)) {
          return;
        }

        if (isWithinEditable(range.startContainer)) {
          return;
        }

        const rect = range.getBoundingClientRect();
        setSelection({text, rect});
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ask-seer-menu]')) {
        setSelection(null);
      }
    };

    const handleScroll = () => {
      setSelection(null);
    };

    container.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('scroll', handleScroll, true);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('scroll', handleScroll, true);
    };
  }, [containerRef]);

  const clear = useCallback(() => setSelection(null), []);
  return {selection, clearSelection: clear};
}

interface AskSeerSelectionMenuProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onAskSeer: (selectedText: string) => void;
}

export function AskSeerSelectionMenu({
  containerRef,
  onAskSeer,
}: AskSeerSelectionMenuProps) {
  const {selection, clearSelection} = useTextSelection(containerRef);
  const menuRef = useRef<HTMLDivElement>(null);

  if (!selection) {
    return null;
  }

  const {rect, text} = selection;
  const top = rect.top - 8;
  const left = rect.left + rect.width / 2;

  return createPortal(
    <MenuWrapper
      ref={menuRef}
      data-ask-seer-menu
      style={{
        top: `${top}px`,
        left: `${left}px`,
      }}
    >
      <Button
        size="xs"
        icon={<IconSeer size="xs" />}
        onClick={() => {
          onAskSeer(text);
          clearSelection();
          window.getSelection()?.removeAllRanges();
        }}
      >
        {t('Ask Seer')}
      </Button>
    </MenuWrapper>,
    document.body
  );
}

const MenuWrapper = styled('div')`
  position: fixed;
  z-index: ${p => p.theme.zIndex.tooltip};
  transform: translate(-50%, -100%);
  pointer-events: auto;

  > button {
    white-space: nowrap;
    /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
`;
