import {Fragment} from 'react';

import {Container} from 'sentry/components/core/layout';
import type {Organization} from 'sentry/types/organization';

import {hasNewBillingUI} from 'getsentry/utils/billing';

function SubscriptionPageContainer({
  children,
  background,
  organization,
  dataTestId,
}: {
  children: React.ReactNode;
  organization: Organization;
  background?: 'primary' | 'secondary';
  dataTestId?: string;
}) {
  const isNewBillingUI = hasNewBillingUI(organization);
  if (!isNewBillingUI) {
    if (dataTestId) {
      return <Container data-test-id={dataTestId}>{children}</Container>;
    }
    return <Fragment>{children}</Fragment>;
  }
  return (
    <Container
      padding={{xs: 'xl xl', md: 'xl 3xl'}}
      background={background}
      height="100%"
      data-test-id={dataTestId}
    >
      {children}
    </Container>
  );
}

export default SubscriptionPageContainer;
