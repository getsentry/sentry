import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {space} from 'sentry/styles/space';

function NotFound() {
  return (
    <SplashWrapper>
      <Flex align="center" margin="3xl 0">
        <HeaderTitle>Not Found</HeaderTitle>
      </Flex>
      <div>
        <strong>Page not found.</strong>
      </div>
    </SplashWrapper>
  );
}

const SplashWrapper = styled('div')`
  padding: ${space(3)};
`;

const HeaderTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: normal;
  color: ${p => p.theme.tokens.content.primary};
`;

export default NotFound;
