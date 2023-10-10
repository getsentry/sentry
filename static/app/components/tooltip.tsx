import {Fragment, useEffect} from 'react';
import {createPortal} from 'react-dom';
import {SerializedStyles, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import {useHoverOverlay, UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';

interface TooltipProps extends UseHoverOverlayProps {
  /**
   * The content to show in the tooltip popover
   */
  title: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Disable the tooltip display entirely
   */
  disabled?: boolean;
  /**
   * Additional style rules for the tooltip content.
   */
  overlayStyle?: React.CSSProperties | SerializedStyles;
}

function Tooltip({
  children,
  overlayStyle,
  title,
  disabled = false,
  ...hoverOverlayProps
}: TooltipProps) {
  const theme = useTheme();
  const {wrapTrigger, isOpen, overlayProps, placement, arrowData, arrowProps, reset} =
    useHoverOverlay('tooltip', hoverOverlayProps);

  // Reset the visibility when the tooltip becomes disabled
  useEffect(() => {
    if (disabled) {
      reset();
    }
  }, [reset, disabled]);

  if (disabled || !title) {
    return <Fragment>{children}</Fragment>;
  }

  const tooltipContent = isOpen && (
    <PositionWrapper zIndex={theme.zIndex.tooltip} {...overlayProps}>
      <TooltipContent
        animated
        arrowProps={arrowProps}
        originPoint={arrowData}
        placement={placement}
        overlayStyle={overlayStyle}
      >
        {title}
      </TooltipContent>
    </PositionWrapper>
  );

  return (
    <Fragment>
      {wrapTrigger(children)}
      {createPortal(<AnimatePresence>{tooltipContent}</AnimatePresence>, document.body)}
    </Fragment>
  );
}

const TooltipContent = styled(Overlay)`
  padding: ${space(1)} ${space(1.5)};
  overflow-wrap: break-word;
  max-width: 225px;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  text-align: center;
`;

export {Tooltip, TooltipProps};
