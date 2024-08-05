import {Fragment, useEffect} from 'react';
import {createPortal} from 'react-dom';
import type {SerializedStyles} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {useModalIsVisible} from 'sentry/components/globalModal/useModalIsVisible';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';
import getModalPortal from 'sentry/utils/getModalPortal';
import type {UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';
import {useHoverOverlay} from 'sentry/utils/useHoverOverlay';

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
  const modalVisible = useModalIsVisible();
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

  // If the tooltip is rendered outside the modal's DOM node, it will be unclickable and unselectable.
  // Therefore, we check if the global modal is active. If it is, the tooltip should be rendered within the same node to ensure interactivity.
  const container = modalVisible ? getModalPortal() : document.body;

  return (
    <Fragment>
      {wrapTrigger(children)}
      {createPortal(<AnimatePresence>{tooltipContent}</AnimatePresence>, container)}
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

export type {TooltipProps};
export {Tooltip};
