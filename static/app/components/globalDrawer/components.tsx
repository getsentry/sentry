import {
  createContext,
  forwardRef,
  Fragment,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import type {AnimationProps} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

export const DrawerPanel = forwardRef(function DrawerPanel(
  {
    ariaLabel,
    children,
    transitionProps,
    onClose,
    drawerWidth,
    drawerKey,
    headerContent: _headerContent,
  }: DrawerPanelProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const resizeHandleRef = useRef<HTMLDivElement>(null);

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

  // Use normal state for the initial width and persisted width
  const [localWidthPercent, setLocalWidthPercent] = useState<number>(() =>
    calculateInitialWidth()
  );

  // Use localStorage state when drawerKey is provided
  const [persistedWidthPercent, setPersistedWidthPercent] =
    useSyncedLocalStorageState<number>(
      drawerKey ? getDrawerWidthKey(drawerKey) : 'drawer-width:default',
      (value?: unknown) => {
        const savedWidth = typeof value === 'number' ? value : undefined;
        return calculateInitialWidth(savedWidth);
      }
    );

  const widthPercent = drawerKey ? persistedWidthPercent : localWidthPercent;
  const setWidthPercent = drawerKey ? setPersistedWidthPercent : setLocalWidthPercent;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const handle = resizeHandleRef.current;
      if (!handle) {
        return;
      }
      const panel = handle.closest('.drawer-panel') as HTMLElement;
      if (!panel) {
        return;
      }
      handle.setAttribute('data-resizing', 'true');

      // Add resizing class to the panel to hide scrollbars
      panel.classList.add('resizing');

      const viewportWidth = window.innerWidth;
      const minWidthPercent = 30;
      const maxWidthPercent = 85;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const newWidthPercent =
          ((viewportWidth - moveEvent.clientX) / viewportWidth) * 100;
        const clampedWidthPercent = Math.min(
          Math.max(newWidthPercent, minWidthPercent),
          maxWidthPercent
        );

        panel.style.width = `${clampedWidthPercent}%`;

        if (handle) {
          handle.setAttribute(
            'data-at-min-width',
            (clampedWidthPercent <= minWidthPercent).toString()
          );
          handle.setAttribute(
            'data-at-max-width',
            (Math.abs(clampedWidthPercent - maxWidthPercent) < 1).toString()
          );
        }
      };

      const handleMouseUp = () => {
        if (handle) {
          handle.removeAttribute('data-resizing');
        }

        // Remove resizing class to restore scrollbars
        if (panel) {
          panel.classList.remove('resizing');
          const currentWidth = parseFloat(panel.style.width) || widthPercent;
          setWidthPercent(currentWidth);
        }

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [setWidthPercent, widthPercent]
  );

  const minWidthPercent = 30;
  const maxWidthPercent = 90;
  const isAtMinWidth = widthPercent <= minWidthPercent;
  const isAtMaxWidth = Math.abs(widthPercent - maxWidthPercent) < 1;

  return (
    <DrawerContainer>
      <DrawerSlidePanel
        ariaLabel={ariaLabel}
        slidePosition="right"
        collapsed={false}
        ref={ref}
        transitionProps={transitionProps}
        panelWidth={`${widthPercent}%`}
        className="drawer-panel"
      >
        {drawerKey && (
          <ResizeHandle
            ref={resizeHandleRef}
            onMouseDown={handleResizeStart}
            data-at-min-width={isAtMinWidth.toString()}
            data-at-max-width={isAtMaxWidth.toString()}
          />
        )}
        <DrawerContentContext.Provider value={{onClose, ariaLabel}}>
          {children}
        </DrawerContentContext.Provider>
      </DrawerSlidePanel>
    </DrawerContainer>
  );
});

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

export const DrawerHeader = forwardRef(function DrawerHeaderInner(
  {
    className,
    children = null,
    hideBar = false,
    hideCloseButton = false,
  }: DrawerHeaderProps,
  ref: React.ForwardedRef<HTMLHeadingElement>
) {
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
});

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

const ResizeHandle = styled('div')`
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: ew-resize;
  z-index: ${p => p.theme.zIndex.drawer + 2};

  &[data-at-min-width='true'] {
    cursor: w-resize;
  }

  &[data-at-max-width='true'] {
    cursor: e-resize;
  }

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
    background: transparent;
    transition: background 0.1s ease;
  }

  &[data-resizing='true']::after {
    background: ${p => p.theme.purple400};
  }
`;

export const DrawerComponents = {
  DrawerBody,
  DrawerHeader,
  DrawerPanel,
};

export default DrawerComponents;
