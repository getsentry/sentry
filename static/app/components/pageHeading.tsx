import styled from '@emotion/styled';

import space from 'sentry/styles/space';

const PageHeading = styled('h1')<{withMargins?: boolean}>`
  ${p => p.theme.text.pageTitle};
  color: ${p => p.theme.headingColor};
  margin: 0;
  margin-bottom: ${p => p.withMargins && space(3)};
  margin-top: ${p => p.withMargins && space(1)};
`;

export default PageHeading;
