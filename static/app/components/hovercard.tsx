import {createContext, Fragment, useCallback, useContext, useMemo, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {State} from '@popperjs/core';
import {useResizeObserver} from '@react-aria/utils';
import {AnimatePresence} from 'framer-motion';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import type {UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';
import {useHoverOverlay} from 'sentry/utils/useHoverOverlay';

interface HovercardProps extends Omit<UseHoverOverlayProps, 'isHoverable'> {
  /**
   * Classname to apply to the hovercard
   */
  children: React.ReactNode;
  /**
   * Whether to animate the hovercard in/out
   */
  animated?: boolean;
  /**
   * Element to display in the body
   */
  body?: React.ReactNode;
  /**
   * Classname to apply to body container
   */
  bodyClassName?: string;
  /**
   * Classname to apply to the hovercard container
   */
  containerClassName?: string;
  /**
   * Element to display in the header
   */
  header?: React.ReactNode;
  /**
   * Container to render the hovercard content
   * Defaults to document.body
   */
  portalContainer?: HTMLElement;
}

type UseOverOverlayState = ReturnType<typeof useHoverOverlay>;

interface HovercardContentProps
  extends Pick<
    HovercardProps,
    'animated' | 'bodyClassName' | 'className' | 'header' | 'body'
  > {
  hoverOverlayState: Omit<UseOverOverlayState, 'isOpen' | 'wrapTrigger'>;
}

interface HovercardProviderValue {
  isOpen: boolean;
  reset: () => void;
  update: (() => Promise<Partial<State>>) | null;
}

const HovercardContext = createContext<HovercardProviderValue>({
  isOpen: false,
  reset: () => {},
  update: null,
});

export function useHovercardContext() {
  return useContext(HovercardContext);
}

function useUpdateOverlayPositionOnContentChange({
  update,
}: Pick<UseOverOverlayState, 'update'>) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onResize = useCallback(() => {
    update?.();
  }, [update]);

  useResizeObserver({
    ref,
    onResize,
  });

  return ref;
}

function HovercardContent({
  animated,
  body,
  bodyClassName,
  className,
  header,
  hoverOverlayState: {arrowData, arrowProps, overlayProps, placement, update},
}: HovercardContentProps) {
  const theme = useTheme();
  const ref = useUpdateOverlayPositionOnContentChange({update});

  return (
    <PositionWrapper zIndex={theme.zIndex.hovercard} {...overlayProps}>
      <StyledHovercard
        animated={animated}
        arrowProps={{
          ...arrowProps,
          size: 20,
        }}
        originPoint={arrowData}
        placement={placement}
        className={className}
        ref={ref}
      >
        {header ? <Header>{header}</Header> : null}
        {body ? <Body className={bodyClassName}>{body}</Body> : null}
      </StyledHovercard>
    </PositionWrapper>
  );
}

function Hovercard({
  body,
  bodyClassName,
  children,
  className,
  containerClassName,
  header,
  offset = 12,
  displayTimeout = 100,
  animated = true,
  portalContainer = document.body,
  ...hoverOverlayProps
}: HovercardProps): React.ReactElement {
  const theme = useTheme();
  const {wrapTrigger, isOpen, ...hoverOverlayState} = useHoverOverlay({
    offset,
    displayTimeout,
    isHoverable: true,
    className: containerClassName,
    ...hoverOverlayProps,
  });

  const contextValue = useMemo<HovercardProviderValue>(
    () => ({
      isOpen,
      reset: hoverOverlayState.reset,
      update: hoverOverlayState.update,
    }),
    [isOpen, hoverOverlayState.reset, hoverOverlayState.update]
  );
  // Nothing to render if no header or body. Be consistent with wrapping the
  // children with the trigger in the case that the body / header is set while
  // the trigger is hovered.
  if (!body && !header) {
    return <Fragment>{wrapTrigger(children)}</Fragment>;
  }

  const hovercardContent = isOpen ? (
    <HovercardContent
      {...{
        animated,
        body,
        bodyClassName,
        className,
        tipBorderColor: theme.tokens.border.primary,
        tipColor: theme.tokens.background.primary,
        header,
        hoverOverlayState,
      }}
    />
  ) : null;

  const hovercard = animated ? (
    <AnimatePresence>{hovercardContent}</AnimatePresence>
  ) : (
    hovercardContent
  );

  return (
    <HovercardContext.Provider value={contextValue}>
      {wrapTrigger(children)}
      {createPortal(hovercard, portalContainer)}
    </HovercardContext.Provider>
  );
}

const StyledHovercard = styled(Overlay)`
  width: 295px;
  line-height: 1.2;
  h6 {
    color: ${p => p.theme.subText};
    font-size: ${p => p.theme.fontSize.xs};
    margin-bottom: ${space(1)};
    text-transform: uppercase;
  }
`;

const Header = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  font-weight: ${p => p.theme.fontWeight.bold};
  word-wrap: break-word;
  padding: ${space(1.5)};
`;

const Body = styled('div')`
  padding: ${space(2)};
  min-height: 30px;
  word-wrap: break-word;
`;

export {Hovercard, Header, Body};
