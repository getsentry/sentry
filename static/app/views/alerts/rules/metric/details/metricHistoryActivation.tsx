import {Fragment} from 'react';

import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {
  ActivationConditionType,
  ActivationTrigger,
  type ActivationTriggerActivity,
} from 'sentry/types/alerts';
import type {Organization} from 'sentry/types/organization';
import getDynamicText from 'sentry/utils/getDynamicText';
import {StyledDateTime} from 'sentry/views/alerts/rules/metric/details/styles';

type MetricHistoryActivationProps = {
  activationActivity: ActivationTriggerActivity;
  organization: Organization;
};

export default function MetricHistoryActivation({
  activationActivity,
  organization,
}: MetricHistoryActivationProps) {
  let trigger: any;
  let activator: any;
  switch (activationActivity.conditionType) {
    case String(ActivationConditionType.RELEASE_CREATION):
      activator = (
        <GlobalSelectionLink
          to={{
            pathname: `/organizations/${
              organization.slug
            }/releases/${encodeURIComponent(activationActivity.activator)}/`,
          }}
        >
          {activationActivity.activator}
        </GlobalSelectionLink>
      );
      trigger = <span>Release {activator} created.</span>;
      break;
    case String(ActivationConditionType.DEPLOY_CREATION):
      activator = activationActivity.activator;
      trigger = `Deploy ${activator} created.`;
      break;
    default:
      trigger = '--';
  }

  return (
    <Fragment>
      <div />
      <div>
        {trigger}{' '}
        {activationActivity.type === ActivationTrigger.ACTIVATED
          ? 'Start monitoring.'
          : 'Finish monitoring.'}
      </div>
      <div />
      <div>
        <StyledDateTime
          date={getDynamicText({
            value: activationActivity.dateCreated,
            fixed: 'Mar 4, 2022 10:44:13 AM UTC',
          })}
          year
          seconds
          timeZone
        />
      </div>
    </Fragment>
  );
}
