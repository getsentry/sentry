import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

function NotFound() {
  return (
    <Container padding="2xl">
      <Flex align="center" margin="3xl 0">
        <HeaderTitle>Not Found</HeaderTitle>
      </Flex>
      <div>
        <strong>Page not found.</strong>
      </div>
    </Container>
  );
}

const HeaderTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.font.size.xl};
  font-weight: normal;
  color: ${p => p.theme.tokens.content.primary};
`;

export default NotFound;
