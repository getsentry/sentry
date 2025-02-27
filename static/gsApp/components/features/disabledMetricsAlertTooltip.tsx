import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';

import UpgradeOrTrialButton from 'getsentry/components/upgradeOrTrialButton';
import withSubscription from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';

type Props = React.PropsWithChildren<{
  organization: Organization;
  subscription: Subscription;
}>;

function DisabledMetricsAlertTooltip({organization, subscription, children}: Props) {
  return (
    <Tooltip
      isHoverable
      title={
        <Fragment>
          <Description>
            {t('This type of alert is not available on your plan.')}
          </Description>
          <UpgradeOrTrialButton
            size="xs"
            organization={organization}
            source="metrics"
            subscription={subscription}
          />
        </Fragment>
      }
    >
      {children}
    </Tooltip>
  );
}

export default withSubscription(DisabledMetricsAlertTooltip);

const Description = styled('div')`
  margin: 0 0 ${space(1)} 0;
`;
