import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Container} from '@sentry/scraps/layout';
import type {ContainerProps} from '@sentry/scraps/layout';

export function SubscriptionPageContainer({
  children,
  ...rest
}: {children: React.ReactNode} & Omit<ContainerProps, 'children'>) {
  useEffect(() => {
    Sentry.getReplay()?.start();
  }, []);

  return (
    <Container background="primary" flexGrow={1} padding="xl" {...rest}>
      {children}
    </Container>
  );
}
