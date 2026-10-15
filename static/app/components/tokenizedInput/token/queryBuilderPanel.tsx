import {useCallback, type PointerEvent, type ReactNode, type Ref} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

interface QueryBuilderPanelProps {
  children: ReactNode;
  'data-test-id': string;
  onMenuContainerRef: (element: HTMLDivElement | null) => void;
  ref?: Ref<HTMLDivElement | null>;
}

const panelChromeOffset = (spaceSm: string) => `calc(-${spaceSm} - 1px)`;

/**
 * Renders a query/equation input in document flow, with panel chrome and
 * suggestions absolutely positioned around it so opening the menu does not
 * shift surrounding layout.
 */
export function QueryBuilderPanel({
  children,
  'data-test-id': dataTestId,
  onMenuContainerRef,
  ref,
}: QueryBuilderPanelProps) {
  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget ||
      (event.target instanceof Element &&
        event.target.hasAttribute('data-query-builder-menu'))
    ) {
      // Padding and the suggestions gap are part of the editor; keep focus.
      event.preventDefault();
    }
  }, []);

  return (
    <PanelRoot
      ref={ref}
      data-test-id={dataTestId}
      position="relative"
      width="100%"
      minWidth="0"
      onPointerDown={handlePointerDown}
    >
      <InputLayer>{children}</InputLayer>
      <MenuSlot ref={onMenuContainerRef} data-query-builder-menu />
    </PanelRoot>
  );
}

const PanelRoot = styled(Container)`
  isolation: isolate;

  &:has([data-query-builder-menu] [data-overlay])::before {
    content: '';
    position: absolute;
    z-index: 0;
    top: ${p => panelChromeOffset(p.theme.space.sm)};
    left: ${p => panelChromeOffset(p.theme.space.sm)};
    right: ${p => panelChromeOffset(p.theme.space.sm)};
    bottom: ${p => panelChromeOffset(p.theme.space.sm)};
    background: ${p => p.theme.tokens.background.overlay};
    border: 1px solid ${p => p.theme.tokens.border.primary};
    border-bottom: none;
    border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
    box-shadow: ${p => p.theme.shadow.medium};
  }
`;

const InputLayer = styled(Container)`
  position: relative;
  z-index: 1;
`;

const MenuSlot = styled(Container)`
  [data-overlay] {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  [role='listbox'] {
    width: 100%;
    min-width: 0;
    text-align: left;
  }

  &:has([data-overlay]) {
    position: absolute;
    z-index: 1;
    top: 100%;
    left: ${p => panelChromeOffset(p.theme.space.sm)};
    right: ${p => panelChromeOffset(p.theme.space.sm)};
    padding-top: ${p => p.theme.space.sm};
    background: ${p => p.theme.tokens.background.overlay};
    border: 1px solid ${p => p.theme.tokens.border.primary};
    border-top: none;
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  }
`;
