import {createContext, Fragment, useCallback, useContext, useRef} from 'react';
import styled from '@emotion/styled';
import type {AnimationProps} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

interface DrawerContentContextType {
  ariaLabel: string;
  onClose: DrawerOptions['onClose'];
}

const DrawerContentContext = createContext<DrawerContentContextType>({
  onClose: () => {},
  ariaLabel: 'slide out drawer',
});

export function useDrawerContentContext() {
  return useContext(DrawerContentContext);
}

interface DrawerPanelProps {
  ariaLabel: DrawerContentContextType['ariaLabel'];
  children: React.ReactNode;
  headerContent: React.ReactNode;
  onClose: DrawerContentContextType['onClose'];
  drawerKey?: string;
  drawerWidth?: DrawerOptions['drawerWidth'];
  transitionProps?: AnimationProps['transition'];
}

function getDrawerWidthKey(drawerKey: string) {
  return `drawer-width:${drawerKey}`;
}

export function DrawerPanel({
  ref,
  ariaLabel,
  children,
  transitionProps,
  onClose,
  drawerWidth,
  drawerKey,
}: DrawerPanelProps & {
  ref?: React.Ref<HTMLDivElement>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate initial width from props or default to 50%
  const calculateInitialWidth = (savedWidth?: number) => {
    // If we have a saved width, use it but ensure it's within bounds
    if (savedWidth !== undefined) {
      const minWidthPercent = 30;
      const maxWidthPercent = 90;
      return Math.min(Math.max(savedWidth, minWidthPercent), maxWidthPercent);
    }

    if (drawerWidth) {
      // If width is already in percentage, parse and clamp it
      if (drawerWidth.endsWith('%')) {
        const parsedPercent = parseFloat(drawerWidth);
        const minWidthPercent = 30;
        const maxWidthPercent = 90;
        return Math.min(Math.max(parsedPercent, minWidthPercent), maxWidthPercent);
      }
      // If width is in pixels, convert to percentage and clamp

      const viewportWidth = typeof window === 'undefined' ? 1000 : window.innerWidth;
      const parsedPixels = parseFloat(drawerWidth);
      const percentValue = (parsedPixels / viewportWidth) * 100;
      const minWidthPercent = 30;
      const maxWidthPercent = 90;
      return Math.min(Math.max(percentValue, minWidthPercent), maxWidthPercent);
    }

    return 50; // Default to 50%
  };

  // Handle persisted width
  const [persistedWidthPercent, setPersistedWidthPercent] =
    useSyncedLocalStorageState<number>(
      drawerKey ? getDrawerWidthKey(drawerKey) : 'drawer-width:default',
      (value?: unknown) => {
        const savedWidth = typeof value === 'number' ? value : undefined;
        return calculateInitialWidth(savedWidth);
      }
    );

  const handleResize = useCallback(
    (newSize: number, userEvent: boolean) => {
      if (panelRef.current) {
        // Convert pixel values from useResizableDrawer to viewport percentage
        const viewportWidth = window.innerWidth;
        const widthPercent = (newSize / viewportWidth) * 100;

        panelRef.current.style.width = `${widthPercent}%`;
      }

      // Only update persisted width after user interaction
      if (userEvent && drawerKey) {
        // Store as percentage
        const viewportWidth = window.innerWidth;
        const percentValue = (newSize / viewportWidth) * 100;
        setPersistedWidthPercent(percentValue);
      }
    },
    [drawerKey, setPersistedWidthPercent]
  );

  const MIN_WIDTH_PERCENT = 30;
  const MAX_WIDTH_PERCENT = 90;
  const viewportWidth = typeof window === 'undefined' ? 1000 : window.innerWidth;
  const minWidthPixels = (viewportWidth * MIN_WIDTH_PERCENT) / 100;
  const maxWidthPixels = (viewportWidth * MAX_WIDTH_PERCENT) / 100;
  const initialSizePixels = (viewportWidth * persistedWidthPercent) / 100;

  const {isHeld, onMouseDown} = useResizableDrawer({
    direction: 'right',
    initialSize: initialSizePixels,
    min: minWidthPixels,
    max: maxWidthPixels,
    onResize: handleResize,
    sizeStorageKey: drawerKey ? getDrawerWidthKey(drawerKey) : undefined,
  });

  return (
    <DrawerContainer>
      <DrawerSlidePanel
        ariaLabel={ariaLabel}
        slidePosition="right"
        collapsed={false}
        ref={node => {
          panelRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            (ref as React.RefObject<HTMLDivElement | null>).current = node;
          }
        }}
        transitionProps={transitionProps}
        panelWidth={`${persistedWidthPercent}%`}
        className={`drawer-panel${isHeld ? ' resizing' : ''}`}
      >
        {drawerKey && (
          <ResizeHandle
            onMouseDown={onMouseDown}
            isResizing={isHeld}
            isAtMinWidth={persistedWidthPercent <= MIN_WIDTH_PERCENT}
            isAtMaxWidth={persistedWidthPercent >= MAX_WIDTH_PERCENT}
          />
        )}
        <DrawerContentContext.Provider value={{onClose, ariaLabel}}>
          {children}
        </DrawerContentContext.Provider>
      </DrawerSlidePanel>
    </DrawerContainer>
  );
}

interface DrawerHeaderProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * If true, hides the spacer bar separating close button from custom header content
   */
  hideBar?: boolean;
  /**
   * If true, hides the close button
   */
  hideCloseButton?: boolean;
}

export function DrawerHeader({
  ref,
  className,
  children = null,
  hideBar = false,
  hideCloseButton = false,
}: DrawerHeaderProps & {
  ref?: React.Ref<HTMLHeadingElement>;
}) {
  const {onClose} = useDrawerContentContext();

  return (
    <Header ref={ref} className={className}>
      {!hideCloseButton && (
        <Fragment>
          <CloseButton
            priority="link"
            size="xs"
            borderless
            aria-label={t('Close Drawer')}
            icon={<IconClose />}
            onClick={onClose}
          >
            {t('Close')}
          </CloseButton>
          {!hideBar && <HeaderBar />}
        </Fragment>
      )}
      {children}
    </Header>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const HeaderBar = styled('div')`
  margin: 0 ${space(2)};
  border-right: 1px solid ${p => p.theme.border};
`;

const Header = styled('header')`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.drawer + 1};
  background: ${p => p.theme.background};
  justify-content: flex-start;
  display: flex;
  padding: ${space(1.5)};
  box-shadow: ${p => p.theme.border} 0 1px;
  padding-left: 24px;
`;

export const DrawerBody = styled('aside')`
  padding: ${space(2)} 24px;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const DrawerContainer = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;
`;

const DrawerSlidePanel = styled(SlideOverPanel)`
  box-shadow: 0 0 0 1px ${p => p.theme.dropShadowHeavy};
  border-left: 1px solid ${p => p.theme.border};
  position: relative;
  pointer-events: auto;

  &.resizing {
    /* Hide scrollbars during resize */
    overflow: hidden !important;

    /* Hide scrollbars in Firefox */
    scrollbar-width: none;

    /* Hide scrollbars in WebKit browsers */
    &::-webkit-scrollbar {
      display: none;
    }

    /* Apply to all scrollable children */
    * {
      overflow: hidden !important;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  }
`;

const ResizeHandle = styled('div')<{
  isResizing: boolean;
  isAtMaxWidth?: boolean;
  isAtMinWidth?: boolean;
}>`
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: ${p => {
    if (p.isAtMinWidth) {
      return 'w-resize';
    }
    if (p.isAtMaxWidth) {
      return 'e-resize';
    }
    return 'ew-resize';
  }};
  z-index: ${p => p.theme.zIndex.drawer + 2};

  &:hover,
  &:active {
    &::after {
      background: ${p => p.theme.purple400};
    }
  }

  &::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 0;
    bottom: 0;
    width: 4px;
    opacity: 0.8;
    background: ${p => (p.isResizing ? p.theme.purple400 : 'transparent')};
    transition: background 0.1s ease;
  }
`;

export const DrawerComponents = {
  DrawerBody,
  DrawerHeader,
  DrawerPanel,
};

export default DrawerComponents;
