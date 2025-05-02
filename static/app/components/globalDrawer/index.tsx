import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {Interpolation, Theme} from '@emotion/react';
import type {AnimationProps} from 'framer-motion';
import {AnimatePresence} from 'framer-motion';
import type {Location} from 'history';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {DrawerComponents} from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocation} from 'sentry/utils/useLocation';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';

export interface DrawerOptions {
  /**
   * Accessbility label for the drawer
   */
  ariaLabel: string;
  /**
   * If true (default), closes the drawer when an escape key is pressed
   */
  closeOnEscapeKeypress?: boolean;
  /**
   * If true (default), closes the drawer when anywhere else is clicked
   */
  closeOnOutsideClick?: boolean;
  /**
   * Custom CSS for the drawer
   */
  drawerCss?: Interpolation<Theme>;
  /**
   * Key to identify the drawer and enable persistence of the drawer width
   */
  drawerKey?: string;
  /**
   * Custom width for the drawer
   */
  drawerWidth?: string;
  /**
   * Custom content for the header of the drawer
   */
  headerContent?: React.ReactNode;
  /**
   * Callback for when the drawer closes
   */
  onClose?: () => void;
  /**
   * Callback for when the drawer opens
   */
  onOpen?: () => void;
  /**
   * If true (default), allows the drawer to be resized - requires `drawerKey`
   * to be defined
   */
  resizable?: boolean;
  /**
   * Function to determine whether the drawer should close when interacting with
   * other elements.
   */
  shouldCloseOnInteractOutside?: (interactedElement: Element) => boolean;
  /**
   * If true (default), closes the drawer when the location changes
   */
  shouldCloseOnLocationChange?: (nextLocation: Location) => boolean;
  //
  // Custom framer motion transition for the drawer
  //
  transitionProps?: AnimationProps['transition'];
}

interface DrawerRenderProps {
  /**
   * Close the drawer
   */
  closeDrawer: () => void;
}

type DrawerRenderer = (renderProps: DrawerRenderProps) => React.ReactNode;

export interface DrawerConfig {
  options: DrawerOptions;
  renderer: DrawerRenderer | null;
}

interface DrawerContextType {
  closeDrawer: () => void;
  isDrawerOpen: boolean;
  openDrawer: (
    renderer: DrawerConfig['renderer'],
    options: DrawerConfig['options']
  ) => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
}

const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  isDrawerOpen: false,
  closeDrawer: () => {},
  panelRef: {current: null},
});

export function GlobalDrawer({children}: any) {
  const location = useLocation();
  const [currentDrawerConfig, overwriteDrawerConfig] = useState<
    DrawerConfig | undefined
  >();
  // Used to avoid adding `currentDrawerConfig` as a dependency to the below
  // `useLayoutEffect`. It's only used as a callback when `location` changes.
  const currentDrawerConfigRef = useRef(currentDrawerConfig);

  // If no config is set, the global drawer is closed.
  const isDrawerOpen = !!currentDrawerConfig;
  const openDrawer = useCallback<DrawerContextType['openDrawer']>((renderer, options) => {
    overwriteDrawerConfig({renderer, options});
    options.onOpen?.();
  }, []);
  const closeDrawer = useCallback<DrawerContextType['closeDrawer']>(
    () => overwriteDrawerConfig(undefined),
    []
  );

  const handleClose = useCallback(() => {
    currentDrawerConfig?.options?.onClose?.();
    closeDrawer();
  }, [currentDrawerConfig, closeDrawer]);

  useEffect(() => {
    currentDrawerConfigRef.current = currentDrawerConfig;
  }, [currentDrawerConfig]);

  // Close the drawer when the browser history changes.
  useLayoutEffect(
    () => {
      if (
        // No need to close drawer if it is not open
        currentDrawerConfigRef.current !== undefined &&
        // Otherwise, when the location changes, check callback or default to closing the drawer if it doesn't exist
        (currentDrawerConfigRef.current.options?.shouldCloseOnLocationChange?.(
          location
        ) ??
          true)
      ) {
        // Call `closeDrawer` without invoking `onClose` callback, since those callbacks often update the URL
        closeDrawer();
      }
    },
    // Ignoring changes to currentDrawerConfig and currentDrawerConfig?.options
    // to prevent closing the drawer when it opens.
    [closeDrawer, location]
  );

  // Close the drawer when clicking outside the panel and options allow it.
  const panelRef = useRef<HTMLDivElement>(null);
  const handleClickOutside = useCallback(() => {
    if (currentDrawerConfig?.options?.closeOnOutsideClick ?? true) {
      handleClose();
    }
  }, [currentDrawerConfig, handleClose]);
  const {shouldCloseOnInteractOutside} = currentDrawerConfig?.options ?? {};
  useOnClickOutside(panelRef, e => {
    if (
      defined(shouldCloseOnInteractOutside) &&
      defined(e?.target) &&
      !shouldCloseOnInteractOutside(e.target as Element)
    ) {
      return;
    }
    handleClickOutside();
  });

  // Close the drawer when escape is pressed and options allow it.
  const globalDrawerHotkeys = useMemo(() => {
    return [
      {
        match: 'Escape',
        callback: () => {
          if (currentDrawerConfig?.options?.closeOnEscapeKeypress ?? true) {
            handleClose();
          }
        },
      },
    ];
  }, [currentDrawerConfig?.options?.closeOnEscapeKeypress, handleClose]);

  useHotkeys(globalDrawerHotkeys);

  const renderedChild = currentDrawerConfig?.renderer
    ? currentDrawerConfig.renderer({
        closeDrawer: handleClose,
      })
    : null;

  return (
    <DrawerContext value={{closeDrawer, isDrawerOpen, openDrawer, panelRef}}>
      <ErrorBoundary
        mini
        allowDismiss
        message={t('There was a problem rendering the drawer.')}
      >
        <AnimatePresence>
          {isDrawerOpen && (
            <DrawerComponents.DrawerPanel
              ariaLabel={currentDrawerConfig.options.ariaLabel}
              onClose={handleClose}
              ref={panelRef}
              headerContent={currentDrawerConfig?.options?.headerContent ?? null}
              transitionProps={currentDrawerConfig?.options?.transitionProps}
              drawerWidth={currentDrawerConfig?.options?.drawerWidth}
              drawerKey={currentDrawerConfig?.options?.drawerKey}
              resizable={currentDrawerConfig?.options?.resizable}
              drawerCss={currentDrawerConfig?.options?.drawerCss}
            >
              {renderedChild}
            </DrawerComponents.DrawerPanel>
          )}
        </AnimatePresence>
      </ErrorBoundary>
      {children}
    </DrawerContext>
  );
}

/**
 * Returns helper functions to control the slide out drawer above the page content. For example:
 * ```
 * const {openDrawer, closeDrawer} = useDrawer()
 * ```
 *
 * The `openDrawer` function accepts a renderer, and options. By default, the drawer will close
 * on outside clicks, and 'Escape' key presses. For example:
 * ```
 * openDrawer(() => <DrawerBody><MyComponent /></DrawerBody>, {closeOnOutsideClick: false})
 * ```
 *
 * The `closeDrawer` function accepts no parameters and closes the drawer, unmounting its contents.
 * For example:
 * ```
 * openDrawer(() => <button onClick={closeDrawer}>Close!</button>)
 * ```
 */
export default function useDrawer() {
  return useContext(DrawerContext);
}
