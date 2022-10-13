import {ComponentProps, Fragment, useCallback} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';

interface GroupPreviewHovercardProps extends ComponentProps<typeof Hovercard> {
  hide?: boolean;
}

export const GroupPreviewHovercard = ({
  className,
  children,
  hide,
  body,
  ...props
}: GroupPreviewHovercardProps) => {
  const handleStackTracePreviewClick = useCallback(
    (e: React.MouseEvent) => void e.stopPropagation(),
    []
  );

  // No need to preview on hover for small devices
  const shouldNotPreview = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  if (shouldNotPreview) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <StyledHovercardWithBodyClass
      className={className}
      displayTimeout={200}
      delay={100}
      position="right"
      tipBorderColor="border"
      tipColor="background"
      hide={hide}
      body={<div onClick={handleStackTracePreviewClick}>{body}</div>}
      {...props}
    >
      {children}
    </StyledHovercardWithBodyClass>
  );
};

// This intermediary is necessary to generate bodyClassName with styled components
const HovercardWithBodyClass = ({className, ...rest}: GroupPreviewHovercardProps) => {
  return <StyledHovercard bodyClassName={className} {...rest} />;
};

const StyledHovercardWithBodyClass = styled(HovercardWithBodyClass)`
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
`;

const StyledHovercard = styled(Hovercard)<{hide?: boolean}>`
  /* Lower z-index to match the modals (10000 vs 10002) to allow stackTraceLinkModal be on top of stack trace preview. */
  z-index: ${p => p.theme.zIndex.modal};
  width: auto;

  ${p =>
    p.hide &&
    css`
      visibility: hidden;
    `};

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
