import {Fragment} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {AnimatePresence} from 'framer-motion';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import space from 'sentry/styles/space';
import {ColorOrAlias} from 'sentry/utils/theme';
import {useHoverOverlay, UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';

interface HovercardProps extends Omit<UseHoverOverlayProps, 'isHoverable'> {
  /**
   * Classname to apply to the hovercard
   */
  children: React.ReactNode;
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
   * Color of the arrow tip border
   */
  tipBorderColor?: ColorOrAlias;
  /**
   * Color of the arrow tip
   */
  tipColor?: ColorOrAlias;
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
  tipBorderColor = 'translucentBorder',
  tipColor = 'backgroundElevated',
  ...hoverOverlayProps
}: HovercardProps): React.ReactElement {
  const theme = useTheme();
  const {wrapTrigger, isOpen, overlayProps, placement, arrowData, arrowProps} =
    useHoverOverlay('hovercard', {
      offset,
      displayTimeout,
      isHoverable: true,
      className: containerClassName,
      ...hoverOverlayProps,
    });

  // Nothing to render if no header or body. Be consistent with wrapping the
  // children with the trigger in the case that the body / header is set while
  // the trigger is hovered.
  if (!body && !header) {
    return <Fragment>{wrapTrigger(children)}</Fragment>;
  }

  const hovercardContent = isOpen && (
    <PositionWrapper zIndex={theme.zIndex.hovercard} {...overlayProps}>
      <StyledHovercard
        animated
        showArrow
        arrowProps={{
          ...arrowProps,
          size: 20,
          background: tipColor,
          border: tipBorderColor,
        }}
        originPoint={arrowData}
        placement={placement}
        className={classNames('hovercard', className)}
      >
        {header ? <Header>{header}</Header> : null}
        {body ? <Body className={bodyClassName}>{body}</Body> : null}
      </StyledHovercard>
    </PositionWrapper>
  );

  return (
    <Fragment>
      {wrapTrigger(children)}
      {createPortal(<AnimatePresence>{hovercardContent}</AnimatePresence>, document.body)}
    </Fragment>
  );
}

const StyledHovercard = styled(Overlay)`
  width: 295px;
  /* The hovercard may appear in different contexts, don't inherit fonts */
  font-family: ${p => p.theme.text.family};
`;

const Header = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadiusTop};
  font-weight: 600;
  word-wrap: break-word;
  padding: ${space(1.5)};
`;

const Body = styled('div')`
  padding: ${space(2)};
  min-height: 30px;
`;

export {Hovercard, Header, Body};
