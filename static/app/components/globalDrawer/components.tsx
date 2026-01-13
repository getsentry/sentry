import {createContext, Fragment, useContext} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import type {Transition} from 'framer-motion';

import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';

import {Button} from 'sentry/components/core/button';
import type {DrawerOptions} from 'sentry/components/globalDrawer';
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
  drawerCss?: DrawerOptions['drawerCss'];
  drawerKey?: string;
  drawerWidth?: DrawerOptions['drawerWidth'];
  ref?: React.Ref<HTMLDivElement>;
  resizable?: DrawerOptions['resizable'];
  transitionProps?: Transition;
}

function DrawerPanel({
  ref,
  ariaLabel,
  children,
  transitionProps,
  onClose,
  drawerWidth,
  drawerKey,
  resizable = true,
  drawerCss,
}: DrawerPanelProps) {
  const {panelRef, resizeHandleRef, handleResizeStart, persistedWidthPercent, enabled} =
    useDrawerResizing({
      drawerKey,
      drawerWidth,
      enabled: resizable,
    });

  // Calculate actual drawer width in pixels
  const actualDrawerWidth =
    (window.innerWidth * (enabled ? persistedWidthPercent : 100)) / 100;

  return (
    <DrawerContainer>
      <DrawerWidthContext.Provider value={actualDrawerWidth}>
        <DrawerSlidePanel
          ariaLabel={ariaLabel}
          position="right"
          ref={mergeRefs(panelRef, ref)}
          transitionProps={transitionProps}
          panelWidth="var(--drawer-width)" // Initial width only
          className="drawer-panel"
          css={drawerCss}
        >
          {drawerKey && enabled && (
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
  ref?: React.Ref<HTMLHeadingElement>;
}

export function DrawerHeader({
  ref,
  className,
  children = null,
  hideBar = false,
  hideCloseButton = false,
}: DrawerHeaderProps) {
  const {onClose} = useDrawerContentContext();

  return (
    <Header
      ref={ref}
      className={className}
      hideCloseButton={hideCloseButton}
      hideBar={hideBar}
    >
      {!hideCloseButton && (
        <Fragment>
          <Button
            priority="transparent"
            size="xs"
            aria-label={t('Close Drawer')}
            icon={<IconClose />}
            onClick={onClose}
          >
            {t('Close')}
          </Button>
          {!hideBar && <HeaderBar />}
        </Fragment>
      )}
      {children}
    </Header>
  );
}

const HeaderBar = styled('div')`
  margin: 0 ${space(2)};
  margin-left: ${space(1)};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
`;

const Header = styled('header')<{hideBar?: boolean; hideCloseButton?: boolean}>`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.drawer + 1};
  background: ${p => p.theme.tokens.background.primary};
  justify-content: flex-start;
  display: flex;
  flex-shrink: 0;
  gap: ${p => (p.hideBar ? space(1) : 0)};
  padding: ${space(1.5)};
  box-shadow: ${p => p.theme.tokens.border.primary} 0 1px;
  padding-left: ${p => (p.hideCloseButton ? '24px' : space(2))};
  padding-top: ${p => (p.hideCloseButton ? space(1.5) : space(0.75))};
  padding-bottom: ${p => (p.hideCloseButton ? space(1.5) : space(0.75))};
`;

export const DrawerBody = styled('aside')`
  padding: ${space(2)} 24px;
  font-size: ${p => p.theme.fontSize.md};
`;

const DrawerContainer = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;
`;

const DrawerSlidePanel = styled(SlideOverPanel)`
  box-shadow: 0 0 0 1px ${p => p.theme.dropShadowHeavy};
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
  position: relative;
  pointer-events: auto;
  height: 100%;

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
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }
  }
`;

const ResizeHandle = styled('div')`
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 8px;
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
      background: ${p => p.theme.tokens.graphics.accent.vibrant};
    }
  }

  &::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 0;
    bottom: 0;
    width: 4px;
    opacity: 0.8;
    background: transparent;
    transition: background 0.1s ease;
  }

  &[data-resizing]::after {
    background: ${p => p.theme.tokens.graphics.accent.vibrant};
  }
`;

export const DrawerComponents = {
  DrawerBody,
  DrawerHeader,
  DrawerPanel,
};
