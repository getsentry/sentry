import {Fragment, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Container} from 'sentry/components/core/layout';
import type {ContainerProps} from 'sentry/components/core/layout/container';
import type {Organization} from 'sentry/types/organization';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

import {hasNewBillingUI} from 'getsentry/utils/billing';

function SubscriptionPageContainer({
  header,
  children,
  background,
  organization,
  dataTestId,
  useBorderTopLogic = true,
  paddingOverride,
}: {
  children: React.ReactNode;
  organization: Organization;
  background?: 'primary' | 'secondary';
  dataTestId?: string;
  header?: React.ReactNode;
  paddingOverride?: ContainerProps['padding'];
  useBorderTopLogic?: boolean;
}) {
  const isNewBillingUI = hasNewBillingUI(organization);

  useEffect(() => {
    // record replays for all usage and billing settings pages
    if (isNewBillingUI) {
      Sentry.getReplay()?.start();
    }
  }, [isNewBillingUI]);

  useRouteAnalyticsParams({
    isNewBillingUI,
  });

  if (!isNewBillingUI) {
    if (dataTestId) {
      return <Container data-test-id={dataTestId}>{children}</Container>;
    }
    return <Fragment>{children}</Fragment>;
  }
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
