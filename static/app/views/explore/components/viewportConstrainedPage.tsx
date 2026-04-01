import styled from '@emotion/styled';

import type {FlexProps} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';

interface ViewportConstrainedPageProps extends FlexProps<'main'> {
  constrained?: boolean;
}

/**
 * A page layout that constrains itself to the viewport height to prevent
 * window-level scrolling. Uses CSS size containment so that the page's
 * intrinsic size doesn't bubble up through the flex chain — the flex
 * algorithm sizes it to exactly the remaining space after siblings
 * (TopBar, Footer, etc.), and content within must manage its own
 * overflow (e.g. via scrollable table bodies).
 *
 * When constrained, the footer is also hidden at smaller viewport heights.
 * Similar to mobile, this is to leave more height space for essential UI.
 */
export function ViewportConstrainedPage({
  constrained = true,
  ...props
}: ViewportConstrainedPageProps) {
  if (!constrained) {
    return <Layout.Page {...props} />;
  }

  return <ConstrainedPage minHeight="0" overflow="hidden" {...props} />;
}

const ConstrainedPage = styled(Layout.Page)`
  contain: size;

  @media (max-height: 900px) {
    ~ footer {
      display: none;
    }
  }
`;
