import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {space} from 'sentry/styles/space';

import type {Subscription} from 'getsentry/types';
import formatCurrency from 'getsentry/utils/formatCurrency';

type Props = {
  customer: Subscription;
};

const getLabel = (item: Subscription) => {
  if (item.isEnterpriseTrial) {
    return `Trialing (${item.trialTier} enterprise)`;
  }
  if (item.isTrial) {
    return `Trialing (${item.trialTier})`;
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
    <dd>{formatCurrency(planDetails?.price)}</dd>
    <dt>Contract:</dt>
    <dd>{planDetails?.contractInterval}</dd>
    <dt>Billed:</dt>
    <dd>{planDetails?.billingInterval}</dd>
  </StatusList>
);

const StatusList = styled('dl')`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: 0 ${space(1)};

  dt {
    text-align: right;
  }
  dd {
    text-align: left;
  }
`;

function CustomerStatus({customer}: Props) {
  const label = getLabel(customer);

  return (
    <Fragment>
      {typeof label !== 'object' && label}
      <br />
      <Tooltip title={getTooltip(customer)}>
        <small>{`${customer.planDetails?.name} Plan (${customer.planTier})`}</small>
      </Tooltip>
    </Fragment>
  );
}

export default CustomerStatus;
