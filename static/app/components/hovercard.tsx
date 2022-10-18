import {Fragment, useEffect} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
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
  const {wrapTrigger, isOpen, overlayProps, placement, arrowData, arrowProps, update} =
    useHoverOverlay('hovercard', {
      offset,
      displayTimeout,
      isHoverable: true,
      className: containerClassName,
      ...hoverOverlayProps,
    });

  // Changes to header and body can change the size of the overlay content
  // which can result in the popper state being out of date
  useEffect(() => {
    if (isOpen) {
      update?.();
    }
  }, [isOpen, update, header, body]);

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
        arrowProps={{
          ...arrowProps,
          size: 20,
          background: tipColor,
          border: tipBorderColor,
        }}
        originPoint={arrowData}
        placement={placement}
        className={className}
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
  line-height: 1.2;

  h6 {
    color: ${p => p.theme.subText};
    font-size: ${p => p.theme.fontSizeExtraSmall};
    margin-bottom: ${space(1)};
    text-transform: uppercase;
  }
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

const Divider = styled('div')`
  position: relative;
  margin-top: ${space(1.5)};
  margin-bottom: ${space(1)};

  &:before {
    display: block;
    position: absolute;
    content: '';
    height: 1px;
    top: 50%;
    left: ${space(2)};
    right: ${space(2)};
    background: ${p => p.theme.innerBorder};
    z-index: -1;
  }

  h6 {
    display: inline;
    padding-right: ${space(1)};
    background: ${p => p.theme.background};
  }
`;

export {Hovercard, Header, Body, Divider};
