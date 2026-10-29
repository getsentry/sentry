import type * as React from 'react';
import {createContext, Fragment, useContext, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {useDragSeparator} from '@sentry/scraps/dragHandle';
import {ContainerQueryProvider} from '@sentry/scraps/layout';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';
import {TooltipContext} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {
  DEFAULT_WIDTH_PERCENT,
  MAX_WIDTH_PERCENT,
  MIN_WIDTH_PERCENT,
  useDrawerResizing,
} from './useDrawerResizing';

interface DrawerContentContextType {
  ariaLabel: string;
  onClose?: () => void;
}

const DrawerContentContext = createContext<DrawerContentContextType>({
  onClose: () => {},
  ariaLabel: 'slide out drawer',
});

export function useDrawerContentContext() {
  return useContext(DrawerContentContext);
}

export interface DrawerPanelProps extends DrawerContentContextType {
  children: React.ReactNode;
  mode: 'blocking' | 'passive';
  contentTop?: string;
  drawerMaxWidth?: string;
  drawerWidth?: string;
  isSmallScreen?: boolean;
  minPanelWidth?: number;
  /** Called when a resize ends, so the consumer can save the width. */
  onWidthChange?: (widthPercent: number) => void;
  ref?: React.Ref<HTMLDivElement>;
  resizable?: boolean;
  /** Whether to show the resize handle. The app requires a persistence key. */
  showResizeHandle?: boolean;
  topOffset?: number;
  /** Width resolved by the consumer, for example from a saved preference. */
  widthPercent?: number;
}

export function DrawerPanel({
  ref,
  mode,
  ariaLabel,
  children,
  onClose,
  drawerWidth,
  drawerMaxWidth,
  widthPercent = DEFAULT_WIDTH_PERCENT,
  onWidthChange,
  isSmallScreen = false,
  contentTop,
  minPanelWidth,
  topOffset,
  resizable = true,
  showResizeHandle = true,
}: DrawerPanelProps) {
  const {panelRef, resizeHandleRef, width, handleMove, handleMoveStart, handleMoveEnd} =
    useDrawerResizing({
      widthPercent,
      onWidthChange,
      isSmallScreen,
      drawerWidth,
      drawerMaxWidth,
      enabled: resizable,
    });
  const [tooltipContainer, setTooltipContainer] = useState<HTMLDivElement | null>(null);

  const {t} = useTranslation();
  const {separatorProps, cursor} = useDragSeparator({
    orientation: 'horizontal',
    isSizedFirst: false,
    min: MIN_WIDTH_PERCENT,
    max: MAX_WIDTH_PERCENT,
    value: width,
    onMove: handleMove,
    onMoveStart: handleMoveStart,
    onMoveEnd: handleMoveEnd,
  });

  return (
    <DrawerContainer>
      <DrawerSlidePanel
        mode={mode}
        contentTop={contentTop}
        minPanelWidth={minPanelWidth}
        topOffset={topOffset === undefined ? undefined : `${topOffset}px`}
        height={topOffset === undefined ? undefined : `calc(100% - ${topOffset}px)`}
        ariaLabel={ariaLabel}
        position="right"
        ref={mergeRefs(panelRef, ref, (node: HTMLDivElement | null) =>
          setTooltipContainer(node)
        )}
        panelWidth="var(--drawer-width)" // Initial width only
        className="drawer-panel"
      >
        {resizable && showResizeHandle && !isSmallScreen && (
          <ResizeHandle
            {...separatorProps}
            ref={resizeHandleRef}
            aria-label={t('Resize drawer')}
            style={{cursor}}
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
    </DrawerContainer>
  );
}

export interface DrawerHeaderProps {
  children?: React.ReactNode;
  className?: string;
  /** Header height supplied by the consumer. */
  height?: string;
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
  height,
  hideBar = false,
  hideCloseButton = false,
  hideCloseButtonText = false,
}: DrawerHeaderProps) {
  const {onClose} = useDrawerContentContext();
  const {t} = useTranslation();

  return (
    <Header
      ref={ref}
      className={className}
      hideCloseButton={hideCloseButton}
      hideBar={hideBar}
      height={height}
    >
      {!hideCloseButton && (
        <Fragment>
          <Button
            variant="transparent"
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
  /* oxlint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: ${p => p.theme.tokens.border.primary} 0 1px;
  padding-left: ${p => p.theme.space.lg};
  padding-top: ${p => (p.hideCloseButton ? p.theme.space.lg : p.theme.space.sm)};
  padding-bottom: ${p => (p.hideCloseButton ? p.theme.space.lg : p.theme.space.sm)};
  ${p =>
    p.height &&
    css`
      --drawer-header-height: ${p.height};
      height: var(--drawer-header-height);
      box-sizing: border-box;
      align-items: center;
      box-shadow: none;
      border-bottom: 1px solid ${p.theme.tokens.border.primary};
    `}
`;

export function DrawerBody({ref, ...props}: React.ComponentProps<'aside'>) {
  const bodyRef = useRef<HTMLElement>(null);
  const refs = useMemo(() => mergeRefs(ref, bodyRef), [ref]);

  return (
    <ContainerQueryProvider elementRef={bodyRef}>
      <DrawerBodyElement ref={refs} {...props} />
    </ContainerQueryProvider>
  );
}

const DrawerBodyElement = styled('aside')`
  container-type: inline-size;
  padding: ${p => p.theme.space.xl} 24px;
  font-size: ${p => p.theme.font.size.md};
`;

const DrawerContainer = styled('div')`
  position: fixed;
  inset: 0;
  z-index: ${p => p.theme.zIndex.drawer};
  pointer-events: none;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    overflow-x: auto;
    pointer-events: auto;
  }
`;

const DrawerSlidePanel = styled(SlideOverPanel)<{minPanelWidth?: number}>`
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
  position: relative;
  pointer-events: auto;
  height: ${p => p.height ?? '100%'};

  /* Extend the panel's background 20px past its right edge so the bounce-in
     overshoot doesn't briefly expose the page beneath. A box-shadow is used
     (vs. a pseudo-element) because the panel's own overflow: auto would clip
     anything positioned outside its bounds. */
  /* oxlint-disable-next-line @sentry/scraps/use-semantic-token -- Extend the drawer background beyond its scrollable bounds. */
  box-shadow:
    20px 0 0 ${p => p.theme.tokens.background.overlay},
    ${p => p.theme.shadow.high};

  --drawer-width: ${DEFAULT_WIDTH_PERCENT}%;
  --drawer-min-width: ${MIN_WIDTH_PERCENT}%;
  --drawer-max-width: ${MAX_WIDTH_PERCENT}%;

  width: clamp(
    var(--drawer-min-width),
    var(--drawer-width),
    var(--drawer-max-width)
  ) !important;

  /* A drawer narrower than a pane docked against the viewport's right edge
     (Seer) would leave a strip of that pane showing beside it. */
  ${p =>
    p.minPanelWidth
      ? css`
          min-width: ${p.minPanelWidth}px;
        `
      : null}

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    top: ${p => p.topOffset ?? 0};
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
  touch-action: none;
  user-select: none;
  z-index: ${p => p.theme.zIndex.drawer + 2};

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

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }

  &[data-is-held='true']::after {
    background: ${p => p.theme.tokens.graphics.accent.vibrant};
  }
`;
