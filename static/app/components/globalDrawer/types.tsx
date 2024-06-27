import type {DrawerBody} from 'sentry/components/globalDrawer/components';

export interface DrawerOptions {
  /**
   * Accessbility label for the drawer
   */
  ariaLabel?: string;
  /**
   * If true (default), closes the drawer when an escape key is pressed
   */
  closeOnEscapeKeypress?: boolean;
  /**
   * If true (default), closes the drawer when anywhere else is clicked
   */
  closeOnOutsideClick?: boolean;
  /**
   * Callback for when the drawer closes
   */
  onClose?: () => void;
  /**
   * Callback for when the drawer opens
   */
  onOpen?: () => void;
}

export interface DrawerRenderProps {
  /**
   * Body container for the drawer
   */
  Body: typeof DrawerBody;
  /**
   * Close the drawer
   */
  closeDrawer: () => void;
}

type DrawerRenderer = (renderProps: DrawerRenderProps) => React.ReactNode;

export interface DrawerConfig {
  renderer: DrawerRenderer | null;
  options?: DrawerOptions;
}

export interface DrawerContext {
  closeDrawer: () => void;
  openDrawer: (
    renderer: DrawerConfig['renderer'],
    options?: DrawerConfig['options']
  ) => void;
}
