import {ComponentProps, Fragment, ReactChild} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Body, Hovercard} from 'sentry/components/hovercard';
import useMedia from 'sentry/utils/useMedia';

interface GroupPreviewHovercardProps extends ComponentProps<typeof Hovercard> {
  children: ReactChild;
  className?: string;
  hide?: boolean;
}

const GroupPreviewHovercard = ({
  className,
  children,
  hide,
  ...props
}: GroupPreviewHovercardProps) => {
  const theme = useTheme();

  // No need to preview on hover for small devices
  const shouldNotPreview = useMedia(`(max-width: ${theme.breakpoints.large})`);
  if (shouldNotPreview) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <StyledHovercard
      className={className}
      displayTimeout={200}
      delay={100}
      position="right"
      tipBorderColor="border"
      tipColor="background"
      hide={hide}
      {...props}
    >
      {children}
    </StyledHovercard>
  );
};

const StyledHovercard = styled(Hovercard)<{hide?: boolean}>`
  /* Lower z-index to match the modals (10000 vs 10002) to allow stackTraceLinkModal be on top of stack trace preview. */
  z-index: ${p => p.theme.zIndex.modal};
  width: auto;

  ${p =>
    p.hide &&
    css`
      visibility: hidden;
    `}

  ${Body} {
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }

  .traceback {
    margin-bottom: 0;
    border: 0;
    box-shadow: none;
  }

  .loading {
    margin: 0 auto;
    .loading-indicator {
      /**
      * Overriding the .less file - for default 64px loader we have the width of border set to 6px
      * For 32px we therefore need 3px to keep the same thickness ratio
      */
      border-width: 3px;
    }
  }
`;

export default GroupPreviewHovercard;
