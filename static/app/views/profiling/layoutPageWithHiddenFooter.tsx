import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';

// The footer component is a sibling of this div.
// Remove it so the flamegraph can take up the
// entire screen.
export const LayoutPageWithHiddenFooter = styled(Layout.Page)`
  ~ footer {
    display: none;
  }
`;
