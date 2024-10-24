import {type ComponentProps, forwardRef} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {Overlay} from 'sentry/components/overlay';
import {space} from 'sentry/styles/space';

export const OverlayMenu = forwardRef<
  HTMLDivElement,
  Omit<ComponentProps<typeof StyledOverlay>, `on${string}`>
>(({children, ...props}, ref) => {
  return (
    <StyledOverlay {...props} ref={ref}>
      {children}
    </StyledOverlay>
  );
});

export const OverlayMenuLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(
  ({children, ...props}, ref) => {
    return (
      <StyledLink {...props} ref={ref}>
        <InteractionStateLayer />
        {children}
      </StyledLink>
    );
  }
);

const StyledOverlay = styled(Overlay)`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  background: ${p => p.theme.surface200};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  padding-block: ${space(1)};
  min-width: 256px;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.textColor};
  white-space: nowrap;
  cursor: pointer;
  display: flex;
  flex-grow: 1;
  height: 36px;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: ${space(4)};
  padding: 0 ${space(2)};
  position: relative;

  &:hover,
  :focus-visible {
    color: ${p => p.theme.textColor};
  }
`;
