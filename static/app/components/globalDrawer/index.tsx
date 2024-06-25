import {useCallback} from 'react';
import styled from '@emotion/styled';

import {closeDrawer as closeDrawerAction} from 'sentry/actionCreators/drawer';
import {DrawerBody, DrawerPanel} from 'sentry/components/globalDrawer/components';
import DrawerStore from 'sentry/stores/drawerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {useLocation} from 'sentry/utils/useLocation';

export interface DrawerOptions {
  /** If true (default), closes the drawer when an escape key is pressed */
  closeOnEscapeKeypress?: boolean;
  /** If true (default), closes the drawer when anywhere else is clicked */
  closeOnOutsideClick?: boolean;
  /** Callback for when the drawer closes */
  onClose?: () => void;
  /** Callback for when the drawer opens */
  onOpen?: () => void;
}

export interface DrawerRenderProps {
  /** Body container for the drawer */
  Body: typeof DrawerBody;
  /** Close the drawer */
  closeDrawer: () => void;
}

interface GlobalDrawerProps {
  onClose?: () => void;
}

export default function GlobalDrawer({onClose}: GlobalDrawerProps) {
  const location = useLocation();
  const {renderer, options} = useLegacyStore(DrawerStore);
  const {closeOnEscapeKeypress = true, closeOnOutsideClick = true} = options;

  const closeDrawer = useCallback(() => {
    // Callsite callback when closing the drawer
    options?.onClose?.();
    // Actually close the drawer component
    closeDrawerAction();
    // From GlobalDrawer usage, refocus main content
    onClose?.();
  }, [onClose, options]);

  // Close the drawer when the browser history changes.
  //
  // XXX: We're using useEffectAfterFirstRender primarily to support tests
  // which render the GlobalDrawer after a drawer has already been registered in
  // the drawer store, meaning it would be closed immediately.
  useEffectAfterFirstRender(() => closeDrawerAction(), [location.pathname]);

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
