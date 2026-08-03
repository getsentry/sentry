import {Fragment} from 'react';
import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';

import type {Subscription} from 'getsentry/types';
import {isTrial} from 'getsentry/utils/billing';
import {formatCurrency} from 'getsentry/utils/formatCurrency';

type Props = {
  customer: Subscription;
};

const getLabel = (item: Subscription) => {
  if (item.isEnterpriseTrial) {
    return `Trialing (${item.trialPlan} enterprise)`;
  }
  if (isTrial(item)) {
    return `Trialing (${item.trialPlan})`;
  }
  if (item.isFree) {
    return 'Free Account';
  }
  if (item.status === 'active') {
    return 'Active';
  }
  if (item.status === 'past_due') {
    return 'Past Due';
  }

  return item.status;
};

const getTooltip = ({planDetails, trialPlan}: Subscription) => (
  <StatusList>
    <dt>Plan ID:</dt>
    <dd>{planDetails?.id}</dd>
    {trialPlan && (
      <Fragment>
        <dt>Trial Plan ID:</dt>
        <dd>{trialPlan}</dd>
      </Fragment>
    )}
    <dt>Base Price:</dt>
    <dd>{formatCurrency(planDetails?.totalPrice)}</dd>
    <dt>Billed:</dt>
    <dd>{planDetails?.billingInterval}</dd>
  </StatusList>
);

const StatusList = styled('dl')`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: 0 ${p => p.theme.space.md};

  dt {
    text-align: right;
  }
  dd {
    text-align: left;
  }
`;

export function CustomerStatus({customer}: Props) {
  const label = getLabel(customer);

  return (
    <Fragment>
      {typeof label !== 'object' && label}
      <br />
      <InfoText variant="inherit" title={getTooltip(customer)}>
        <small>{`${customer.planDetails?.name} Plan (${customer.planDetails?.id})`}</small>
      </InfoText>
    </Fragment>
  );
}
