import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Container} from 'sentry/components/core/layout';
import type {ContainerProps} from 'sentry/components/core/layout/container';

export default function SubscriptionPageContainer({
  children,
  background,
  ...rest
}: {children: React.ReactNode} & Omit<ContainerProps, 'children'>) {
  useEffect(() => {
    // record replays for all usage and billing settings pages
    Sentry.getReplay()?.start();
  }, []);

  return (
    <Container
      background={background}
      borderTop={background === 'secondary' ? 'primary' : undefined}
      flexGrow={1}
      padding={{xs: 'xl', md: '3xl'}}
      {...rest}
    >
      {children}
    </Container>
  );
}
