import {Container, Stack} from '@sentry/scraps/layout';

import {AuthPageLayout} from './authPageLayout';

export default function PlainAuthLayout() {
  return (
    <AuthPageLayout>
      {({content, header}) => (
        <Stack as="main" minHeight="100dvh" padding="2xl" background="primary">
          <Container as="header">{header}</Container>
          <Container flex="1" minWidth="0">
            {content}
          </Container>
        </Stack>
      )}
    </AuthPageLayout>
  );
}
