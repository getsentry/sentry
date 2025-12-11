import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

function NotFound() {
  return (
    <SplashWrapper>
      <Header>
        <HeaderTitle>Not Found</HeaderTitle>
      </Header>
      <div>
        <strong>Page not found.</strong>
      </div>
    </SplashWrapper>
  );
}

const SplashWrapper = styled('div')`
  padding: ${space(3)};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  margin: ${space(4)} 0;
`;
const HeaderTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: normal;
  color: ${p => p.theme.tokens.content.primary};
`;

export default NotFound;
