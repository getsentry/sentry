import {Fragment, type ReactNode} from 'react';
import styled from '@emotion/styled';

interface TableActionButtonProps {
  /**
   * Component to render on desktop (≥ md breakpoint)
   */
  desktop: ReactNode;
  /**
   * Component to render on mobile (< md breakpoint)
   */
  mobile: ReactNode;
}

export function TableActionButton({mobile, desktop}: TableActionButtonProps) {
  return (
    <Fragment>
      <MobileWrapper>{mobile}</MobileWrapper>
      <DesktopWrapper>{desktop}</DesktopWrapper>
    </Fragment>
  );
}

const MobileWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;

const DesktopWrapper = styled('div')`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: block;
  }
`;
