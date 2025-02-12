import type {ComponentProps} from 'react';
import {useCallback} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import useMedia from 'sentry/utils/useMedia';

interface GroupPreviewHovercardProps extends ComponentProps<typeof Hovercard> {
  hide?: boolean;
}

export function GroupPreviewHovercard({
  className,
  children,
  hide,
  body,
  ...props
}: GroupPreviewHovercardProps) {
  const theme = useTheme();
  const handleStackTracePreviewClick = useCallback(
    (e: React.MouseEvent) => void e.stopPropagation(),
    []
  );

  // No need to preview on hover for small devices
  const shouldNotPreview = useMedia(`(max-width: ${theme.breakpoints.large})`);
  const shouldShowPositionTop = useMedia(`(max-width: ${theme.breakpoints.xlarge})`);

  return (
    <StyledHovercardWithBodyClass
      className={className}
      displayTimeout={200}
      delay={100}
      position={shouldShowPositionTop ? 'top' : 'right'}
      tipBorderColor="border"
      tipColor="background"
      hide={shouldNotPreview || hide}
      body={<div onClick={handleStackTracePreviewClick}>{body}</div>}
      containerDisplayMode="inline"
      {...props}
    >
      {children}
    </StyledHovercardWithBodyClass>
  );
}

// This intermediary is necessary to generate bodyClassName with styled components
function HovercardWithBodyClass({className, ...rest}: GroupPreviewHovercardProps) {
  return <StyledHovercard bodyClassName={className} {...rest} />;
}

const StyledHovercardWithBodyClass = styled(HovercardWithBodyClass)`
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: ${p => p.theme.borderRadius};
`;

const StyledHovercard = styled(Hovercard)<{hide?: boolean}>`
  /* Lower z-index to match the modals (10000 vs 10002) to allow stackTraceLinkModal be on top of stack trace preview. */
  z-index: ${p => p.theme.zIndex.modal};
  width: auto;

  ${p =>
    p.hide &&
    css`
      display: none;
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
