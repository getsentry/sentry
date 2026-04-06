import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Container} from '@sentry/scraps/layout';
import type {ContainerProps} from '@sentry/scraps/layout';

import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export function SubscriptionPageContainer({
  children,
  background,
  ...rest
}: {children: React.ReactNode} & Omit<ContainerProps, 'children'>) {
  useEffect(() => {
    // record replays for all usage and billing settings pages
    Sentry.getReplay()?.start();
  }, []);

  const hasPageFrame = useHasPageFrameFeature();

  return (
    <Container
      background={hasPageFrame ? 'primary' : background}
      borderTop={background === 'secondary' ? 'primary' : undefined}
      flexGrow={1}
      padding={hasPageFrame ? {sm: 'sm lg', md: 'md xl'} : {xs: 'xl', md: '3xl'}}
      {...rest}
    >
      {children}
    </Container>
  );
}
