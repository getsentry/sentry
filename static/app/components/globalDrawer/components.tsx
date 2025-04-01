import {createContext, Fragment, useContext} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import type {AnimationProps} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {
  DEFAULT_WIDTH_PERCENT,
  MAX_WIDTH_PERCENT,
  MIN_WIDTH_PERCENT,
  useDrawerResizing,
} from './useDrawerResizing';

const DrawerWidthContext = createContext<number | undefined>(undefined);

export function useDrawerWidth() {
  return useContext(DrawerWidthContext);
}

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
  const {panelRef, resizeHandleRef, handleResizeStart, persistedWidthPercent} =
    useDrawerResizing({
      drawerKey,
      drawerWidth,
    });

  // Calculate actual drawer width in pixels
  const actualDrawerWidth = (window.innerWidth * persistedWidthPercent) / 100;

  return (
    <DrawerContainer>
      <DrawerWidthContext.Provider value={actualDrawerWidth}>
        <DrawerSlidePanel
          ariaLabel={ariaLabel}
          slidePosition="right"
          collapsed={false}
          ref={mergeRefs(panelRef, ref)}
          transitionProps={transitionProps}
          panelWidth="var(--drawer-width)" // Initial width only
          className="drawer-panel"
        >
          {drawerKey && (
            <ResizeHandle
              ref={resizeHandleRef}
              onMouseDown={handleResizeStart}
              data-at-min-width={(persistedWidthPercent <= MIN_WIDTH_PERCENT).toString()}
              data-at-max-width={(
                Math.abs(persistedWidthPercent - MAX_WIDTH_PERCENT) < 1
              ).toString()}
            />
          )}
          {/*
            This provider allows data passed to openDrawer to be accessed by drawer components.
            For example: <DrawerHeader />, will trigger the custom onClose callback set in openDrawer
            when it's button is pressed.
          */}
          <DrawerContentContext value={{onClose, ariaLabel}}>
            {children}
          </DrawerContentContext>
        </DrawerSlidePanel>
      </DrawerWidthContext.Provider>
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

  --drawer-width: ${DEFAULT_WIDTH_PERCENT}%;
  --drawer-min-width: ${MIN_WIDTH_PERCENT}%;
  --drawer-max-width: ${MAX_WIDTH_PERCENT}%;

  width: clamp(
    var(--drawer-min-width),
    var(--drawer-width),
    var(--drawer-max-width)
  ) !important;

  &[data-resizing] {
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

  &[data-resizing]::after {
    background: ${p => p.theme.purple400};
  }
`;

export const DrawerComponents = {
  DrawerBody,
  DrawerHeader,
  DrawerPanel,
};
