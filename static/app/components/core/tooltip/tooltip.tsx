import {createContext, Fragment, useContext, useLayoutEffect} from 'react';
import {createPortal} from 'react-dom';
import type {SerializedStyles} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import type {UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';
import {useHoverOverlay} from 'sentry/utils/useHoverOverlay';

interface TooltipContextProps {
  /**
   * Specifies the DOM node where the tooltip should be rendered.
   * This is particularly useful for making the tooltip interactive within specific contexts,
   * such as inside a modal. By default the tooltip is rendered in the 'document.body'.
   */
  container: Element | DocumentFragment | null;
}

export const TooltipContext = createContext<TooltipContextProps>({container: null});

export interface TooltipProps extends UseHoverOverlayProps {
  /**
   * The content to show in the tooltip popover.
   */
  title: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Disable the tooltip display entirely.
   */
  disabled?: boolean;
  /**
   * The max width the tooltip is allowed to grow.
   */
  maxWidth?: number;
  /**
   * Additional style rules for the tooltip content.
   */
  overlayStyle?: React.CSSProperties | SerializedStyles;
}

export function Tooltip({
  children,
  overlayStyle,
  title,
  disabled = false,
  maxWidth,
  ...hoverOverlayProps
}: TooltipProps) {
  const theme = useTheme();
  const {container} = useContext(TooltipContext);
  const {
    wrapTrigger,
    isOpen,
    overlayProps,
    placement,
    arrowData,
    arrowProps,
    reset,
    update,
  } = useHoverOverlay(hoverOverlayProps);

  const {forceVisible} = hoverOverlayProps;

  // Reset the visibility when the tooltip becomes disabled
  useLayoutEffect(() => {
    if (disabled && isOpen) {
      reset();
    }
  }, [reset, disabled, isOpen]);

  // Update the tooltip when the tooltip is forced to be visible and the children change
  useLayoutEffect(() => {
    if (update && forceVisible) {
      update();
    }
  }, [update, children, forceVisible]);

  if (disabled || !title) {
    return children;
  }

  return (
    <Fragment>
      {wrapTrigger(children)}
      {createPortal(
        <AnimatePresence>
          {isOpen ? (
            <PositionWrapper zIndex={theme.zIndex.tooltip} {...overlayProps}>
              <TooltipContent
                animated
                maxWidth={maxWidth}
                arrowProps={arrowProps}
                originPoint={arrowData}
                placement={placement}
                overlayStyle={overlayStyle}
                data-tooltip
              >
                {title}
              </TooltipContent>
            </PositionWrapper>
          ) : null}
        </AnimatePresence>,
        container ?? document.body
      )}
    </Fragment>
  );
}

const TooltipContent = styled(Overlay, {
  shouldForwardProp: prop => prop !== 'maxWidth',
})<{maxWidth?: number}>`
  padding: ${space(1)} ${space(1.5)};
  overflow-wrap: break-word;
  max-width: ${p => p.maxWidth ?? 225}px;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  text-align: center;
`;
