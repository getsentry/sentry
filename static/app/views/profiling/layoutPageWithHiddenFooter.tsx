import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

// The footer component is a sibling of this div.
// Remove it so the flamegraph can take up the
// entire screen.

// @TODO(JonasBadalic): Remove this component once the page-frame feature is GA'd
// When that feature is enabled, the footer is no longer rendered at the bottom of the page.
export const LayoutPageWithHiddenFooter = styled(Stack)`
  ~ footer {
    display: none;
  }
`;
