import {Fragment} from 'react';

import {Container} from 'sentry/components/core/layout';
import type {Organization} from 'sentry/types/organization';

import {hasNewBillingUI} from 'getsentry/utils/billing';

function SubscriptionPageContainer({
  header,
  children,
  background,
  organization,
  dataTestId,
}: {
  children: React.ReactNode;
  organization: Organization;
  background?: 'primary' | 'secondary';
  dataTestId?: string;
  header?: React.ReactNode;
}) {
  const isNewBillingUI = hasNewBillingUI(organization);
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
        padding={{xs: 'xl', md: '3xl'}}
        background={background}
        height="100%"
        data-test-id={dataTestId}
        borderTop={background === 'secondary' ? 'primary' : undefined}
      >
        {children}
      </Container>
    </Fragment>
  );
}

export default SubscriptionPageContainer;
