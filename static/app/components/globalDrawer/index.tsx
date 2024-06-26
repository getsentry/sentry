import {useCallback, useContext, useEffect} from 'react';
import styled from '@emotion/styled';

import {DrawerBody, DrawerPanel} from 'sentry/components/globalDrawer/components';
import {DrawerContext} from 'sentry/components/globalDrawer/context';
import {useLocation} from 'sentry/utils/useLocation';

export interface DrawerOptions {
  //
  // If true (default), closes the drawer when an escape key is pressed
  //
  closeOnEscapeKeypress?: boolean;
  //
  // If true (default), closes the drawer when anywhere else is clicked
  //
  closeOnOutsideClick?: boolean;
  //
  // Callback for when the drawer closes
  //
  onClose?: () => void;
  //
  // Callback for when the drawer opens
  //
  onOpen?: () => void;
}

export interface DrawerRenderProps {
  //
  // Body container for the drawer
  //
  Body: typeof DrawerBody;
  //
  // Close the drawer
  //
  closeDrawer: () => void;
}

interface GlobalDrawerProps {}

export default function GlobalDrawer(_props: GlobalDrawerProps) {
  const location = useLocation();
  const {config, closeDrawer: ctxCloseDrawer} = useContext(DrawerContext);
  const {renderer, options = {}} = config;
  const {closeOnEscapeKeypress = true, closeOnOutsideClick = true} = options;

  const closeDrawer = useCallback(() => {
    // Callsite callback when closing the drawer
    options?.onClose?.();
    // Actually close the drawer component
    ctxCloseDrawer();
  }, [options, ctxCloseDrawer]);

  // Close the drawer when the browser history changes.
  useEffect(() => ctxCloseDrawer(), [location.pathname, ctxCloseDrawer]);

  const isDrawerOpen = typeof renderer === 'function';
  const renderedChild =
    renderer?.({
      Body: DrawerBody,
      closeDrawer,
    }) ?? null;

  return (
    <DrawerContainer data-test-id="drawer-container">
      <DrawerPanel
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onOpen={options?.onOpen}
        closeOnOutsideClick={closeOnOutsideClick}
        closeOnEscapeKeypress={closeOnEscapeKeypress}
      >
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
