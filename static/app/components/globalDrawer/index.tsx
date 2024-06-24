import {useCallback, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {closeDrawer as closeDrawerAction} from 'sentry/actionCreators/drawer';
import {DrawerBody, DrawerPanel} from 'sentry/components/globalDrawer/components';
import DrawerStore from 'sentry/stores/drawerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useKeyPress from 'sentry/utils/useKeyPress';

export interface DrawerOptions {}

export interface DrawerRenderProps {
  Body: typeof DrawerBody;
  closeDrawer: () => void;
  drawerContainerRef?: React.RefObject<HTMLDivElement>;
}

interface GlobalDrawerProps {
  onClose?: () => void;
}

export default function GlobalDrawer({onClose}: GlobalDrawerProps) {
  const {renderer, options: _options} = useLegacyStore(DrawerStore);
  const containerRef = useRef<HTMLDivElement>(null);
  const escapeKeyPressed = useKeyPress('Escape');

  const closeDrawer = useCallback(() => {
    // From GlobalDrawer usage, refocus main content
    onClose?.();
    // Actually close the drawer
    closeDrawerAction();
  }, [onClose]);

  useEffect(() => {
    if (escapeKeyPressed) {
      closeDrawer();
    }
  }, [escapeKeyPressed, closeDrawer]);

  const isDrawerOpen = typeof renderer === 'function';
  const renderedChild = renderer?.({
    Body: DrawerBody,
    drawerContainerRef: containerRef,
    closeDrawer,
  });

  return (
    <DrawerContainer>
      <DrawerPanel isOpen={isDrawerOpen} onClose={closeDrawer}>
        {renderedChild}
      </DrawerPanel>
    </DrawerContainer>
  );
}

const DrawerContainer = styled('div')`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;
`;
