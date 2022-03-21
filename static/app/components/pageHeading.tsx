import styled from '@emotion/styled';

import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  className?: string;
  withMargins?: boolean;
};

const PageHeading = styled('h1')<Props>`
  ${p => p.theme.text.pageTitle};
  color: ${p => p.theme.headingColor};
  margin: 0;
  margin-bottom: ${p => p.withMargins && space(3)};
  margin-top: ${p => p.withMargins && space(1)};
`;

export default PageHeading;
