import {Fragment, type ReactNode} from 'react';

import {Container} from '@sentry/scraps/layout';

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
      <Container display={{zero: 'block', '3xl': 'none'}}>{mobile}</Container>
      <Container display={{zero: 'none', '3xl': 'block'}}>{desktop}</Container>
    </Fragment>
  );
}
