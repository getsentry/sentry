import {Fragment, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Container} from 'sentry/components/core/layout';
import type {ContainerProps} from 'sentry/components/core/layout/container';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

function SubscriptionPageContainer({
  header,
  children,
  background,
  dataTestId,
  useBorderTopLogic = true,
  paddingOverride,
}: {
  children: React.ReactNode;
  background?: 'primary' | 'secondary';
  dataTestId?: string;
  header?: React.ReactNode;
  paddingOverride?: ContainerProps['padding'];
  useBorderTopLogic?: boolean;
}) {
  useEffect(() => {
    // record replays for all usage and billing settings pages
    Sentry.getReplay()?.start();
  }, []);

  useRouteAnalyticsParams({
    isNewBillingUI: true,
  });

  return (
    <Fragment>
      {header}
      <Container
        padding={paddingOverride ?? {xs: 'xl', md: '3xl'}}
        background={background}
        flexGrow={1}
        data-test-id={dataTestId}
        borderTop={
          useBorderTopLogic && background === 'secondary' ? 'primary' : undefined
        }
      >
        {children}
      </Container>
    </Fragment>
  );
}

export default SubscriptionPageContainer;
