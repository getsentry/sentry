import styled from '@emotion/styled';

import type {FlexProps} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {SHORT_VIEWPORT_HEIGHT} from 'sentry/utils/useIsShortViewport';

interface ViewportConstrainedPageProps extends FlexProps<'main'> {
  constrained?: boolean;
  hideFooter?: boolean;
}

/**
 * A page layout that constrains itself to the viewport height to prevent
 * window-level scrolling. Uses CSS size containment so that the page's
 * intrinsic size doesn't bubble up through the flex chain — the flex
 * algorithm sizes it to exactly the remaining space after siblings
 * (TopBar, Footer, etc.), and content within must manage its own
 * overflow (e.g. via scrollable table bodies).
 *
 * When constrained, the global footer sibling is hidden on smaller
 * viewport heights and when `hideFooter` is set.
 */
export function ViewportConstrainedPage({
  constrained = true,
  hideFooter,
  ...rest
}: ViewportConstrainedPageProps) {
  if (!constrained) {
    return <Layout.Page {...rest} />;
  }

  return (
    <ConstrainedPage
      minHeight="0"
      overflow="hidden"
      data-hide-footer={hideFooter ? '' : undefined}
      {...rest}
    />
  );
}

const ConstrainedPage = styled(Layout.Page)`
  contain: size;

  @media (max-height: ${SHORT_VIEWPORT_HEIGHT}px) {
    ~ footer {
      display: none;
    }
  }

  &[data-hide-footer] ~ footer {
    display: none;
  }
`;
