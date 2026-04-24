import {createContext, Fragment, useContext, useState} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import {Button} from '@sentry/scraps/button';
import type {DrawerOptions} from '@sentry/scraps/drawer';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
import {TooltipContext} from '@sentry/scraps/tooltip';

import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import {
  DEFAULT_WIDTH_PERCENT,
  MAX_WIDTH_PERCENT,
  MIN_WIDTH_PERCENT,
  useDrawerResizing,
} from './useDrawerResizing';

const DrawerWidthContext = createContext<number | undefined>(undefined);

type DrawerContentContextType = Pick<DrawerOptions, 'ariaLabel' | 'onClose'>;

const DrawerContentContext = createContext<DrawerContentContextType>({
  onClose: () => {},
  ariaLabel: 'slide out drawer',
});

export function useDrawerContentContext() {
  return useContext(DrawerContentContext);
}

/**
 * Rendering props for the inner DrawerPanel component. Inherits the shared
 * panel-configuration props directly from DrawerOptions so the two interfaces
 * can't drift. GlobalDrawer-only options (onOpen, shouldClose*, onClose
 * callback) are consumed before reaching this component.
 */
interface DrawerPanelProps extends Pick<
  DrawerOptions,
  'ariaLabel' | 'drawerKey' | 'drawerWidth' | 'resizable' | 'onClose'
> {
  children: React.ReactNode;
  /** Required — GlobalDrawer applies the default before passing it down. */
  mode: NonNullable<DrawerOptions['mode']>;
  ref?: React.Ref<HTMLDivElement>;
}

function DrawerPanel({
  ref,
  mode,
  ariaLabel,
  children,
  onClose,
  drawerWidth,
  drawerKey,
  resizable = true,
}: DrawerPanelProps) {
  const {panelRef, resizeHandleRef, handleResizeStart, persistedWidthPercent, enabled} =
    useDrawerResizing({
      drawerKey,
      drawerWidth,
      enabled: resizable,
    });
  const [tooltipContainer, setTooltipContainer] = useState<HTMLDivElement | null>(null);

  // Calculate actual drawer width in pixels
  const actualDrawerWidth =
    (window.innerWidth * (enabled ? persistedWidthPercent : 100)) / 100;

  return (
    <DrawerContainer mode={mode}>
      <DrawerWidthContext.Provider value={actualDrawerWidth}>
        <DrawerSlidePanel
          mode={mode}
          ariaLabel={ariaLabel}
          position="right"
          ref={mergeRefs(panelRef, ref, (node: HTMLDivElement | null) =>
            setTooltipContainer(node)
          )}
          panelWidth="var(--drawer-width)" // Initial width only
          className="drawer-panel"
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
          <TooltipContext value={{container: tooltipContainer}}>
            <DrawerContentContext value={{onClose, ariaLabel}}>
              {children}
            </DrawerContentContext>
          </TooltipContext>
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
  /**
   * If true, hides the label of the close button
   */
  hideCloseButtonText?: boolean;
  ref?: React.Ref<HTMLHeadingElement>;
}

export function DrawerHeader({
  ref,
  className,
  children = null,
  hideBar = false,
  hideCloseButton = false,
  hideCloseButtonText = false,
}: DrawerHeaderProps) {
  const {onClose} = useDrawerContentContext();
  const hasPageFrameFeature = useHasPageFrameFeature();

  return (
    <Header
      ref={ref}
      className={className}
      hideCloseButton={hideCloseButton}
      hideBar={hideBar}
      height={hasPageFrameFeature ? `${PRIMARY_HEADER_HEIGHT}px` : undefined}
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
            {!hideCloseButtonText && t('Close')}
          </Button>
          {!hideBar && <HeaderBar />}
        </Fragment>
      )}
      {children}
    </Header>
  );
}

const HeaderBar = styled('div')`
  margin: 0 ${p => p.theme.space.xl};
  margin-left: ${p => p.theme.space.md};
  align-self: stretch;
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
`;

const Header = styled('header')<{
  height?: string;
  hideBar?: boolean;
  hideCloseButton?: boolean;
}>`
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.drawer + 1};
  background: ${p => p.theme.tokens.background.primary};
  justify-content: flex-start;
  display: flex;
  flex-shrink: 0;
  gap: ${p => (p.hideBar ? p.theme.space.md : 0)};
  padding: ${p => p.theme.space.lg};
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: ${p => p.theme.tokens.border.primary} 0 1px;
  padding-left: ${p => p.theme.space.lg};
  padding-top: ${p => (p.hideCloseButton ? p.theme.space.lg : p.theme.space.sm)};
  padding-bottom: ${p => (p.hideCloseButton ? p.theme.space.lg : p.theme.space.sm)};
  ${p =>
    p.height &&
    `
    --drawer-header-height: ${p.height};
    height: var(--drawer-header-height);
    box-sizing: border-box;
    align-items: center;
    box-shadow: none;
    border-bottom: 1px solid ${p.theme.tokens.border.primary};
  `}
`;

export const DrawerBody = styled('aside')`
  padding: ${p => p.theme.space.xl} 24px;
  font-size: ${p => p.theme.font.size.md};
`;

const DrawerContainer = styled('div')<{mode?: DrawerOptions['mode']}>`
  position: fixed;
  inset: 0;
  /* Passive drawers have no backdrop, so elevate above tooltip to keep
     behind-page tooltips from rendering over the drawer. */
  z-index: ${p =>
    p.mode === 'passive' ? p.theme.zIndex.tooltip + 1 : p.theme.zIndex.drawer};
  pointer-events: none;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    overflow-x: auto;
    pointer-events: auto;
  }
`;

const DrawerSlidePanel = styled(SlideOverPanel)`
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

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    border: none;
    box-shadow: none;
    /* Without this, the base SlideOverPanel's overscroll-behavior: contain blocks horizontal scroll chaining. */
    overscroll-behavior-x: auto;
  }

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
