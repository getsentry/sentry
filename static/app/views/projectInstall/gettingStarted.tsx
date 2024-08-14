import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';

const GettingStarted = styled(Layout.Page)`
  background: ${p => p.theme.background};
  padding-top: ${p => p.theme.space(3)};
`;

GettingStarted.defaultProps = {
  withPadding: true,
};

export default GettingStarted;
