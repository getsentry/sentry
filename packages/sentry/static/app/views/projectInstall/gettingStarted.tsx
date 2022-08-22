import styled from '@emotion/styled';

import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';

const GettingStarted = styled(PageContent)`
  background: ${p => p.theme.background};
  padding-top: ${space(3)};
`;

export default GettingStarted;
