import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';

const GettingStarted = styled(Layout.Page)`
  background: ${p => p.theme.background};
  padding-top: ${space(3)};
`;

export default GettingStarted;
