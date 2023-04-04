import {Fragment} from 'react';
import {createPortal} from 'react-dom';
import {SerializedStyles, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {IS_ACCEPTANCE_TEST} from 'sentry/constants/index';
import {space} from 'sentry/styles/space';
import {useHoverOverlay, UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';

import {AcceptanceTestTooltip} from './acceptanceTestTooltip';

export interface InternalTooltipProps extends UseHoverOverlayProps {
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

// Warning: This component is conditionally exported end-of-file based on IS_ACCEPTANCE_TEST env variable
export const DO_NOT_USE_TOOLTIP = ({
  children,
  overlayStyle,
  title,
  disabled = false,
  ...hoverOverlayProps
}: InternalTooltipProps) => {
  const theme = useTheme();
  const {wrapTrigger, isOpen, overlayProps, placement, arrowData, arrowProps} =
    useHoverOverlay('tooltip', hoverOverlayProps);

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
};

const TooltipContent = styled(Overlay)`
  padding: ${space(1)} ${space(1.5)};
  overflow-wrap: break-word;
  max-width: 225px;
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  text-align: center;
`;

interface TooltipProps extends InternalTooltipProps {
  /**
   * Stops tooltip from being opened during tooltip visual acceptance.
   * Should be set to true if tooltip contains unisolated data (eg. dates)
   */
  disableForVisualTest?: boolean;
}

// Tooltip will enhance the internal tooltip with the open/close functionality
// used in src/sentry/utils/pytest/selenium.py so that tooltips can be opened
// and closed for specific snapshots.

const Tooltip = ({disableForVisualTest, ...props}: TooltipProps) => {
  if (IS_ACCEPTANCE_TEST) {
    return disableForVisualTest ? (
      <Fragment>{props.children}</Fragment>
    ) : (
      <AcceptanceTestTooltip {...props} />
    );
  }

  return <DO_NOT_USE_TOOLTIP {...props} />;
};

export {Tooltip};
