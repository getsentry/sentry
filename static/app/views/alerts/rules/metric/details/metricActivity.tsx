import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {StatusIndicator} from 'sentry/components/statusIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import getDynamicText from 'sentry/utils/getDynamicText';
import {capitalize} from 'sentry/utils/string/capitalize';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {AlertRuleThresholdType} from 'sentry/views/alerts/rules/metric/types';
import type {ActivityType, Incident} from 'sentry/views/alerts/types';
import {IncidentActivityType, IncidentStatus} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

type MetricAlertActivityProps = {
  incident: Incident;
  organization: Organization;
};

function MetricAlertActivity({organization, incident}: MetricAlertActivityProps) {
  // NOTE: while _possible_, we should never expect an incident to _not_ have a status_change activity
  const activities = (incident.activities ?? []).filter(
    activity => activity.type === IncidentActivityType.STATUS_CHANGE
  );
  console.log('ACTIVITIES: ', activities);
  const criticalActivity = activities.find(
    activity => activity.value === `${IncidentStatus.CRITICAL}`
  );
  const warningActivity = activities.find(
    activity => activity.value === `${IncidentStatus.WARNING}`
  );

  // Triggered activity is just the color indicator with the
  const triggeredActivity: ActivityType = criticalActivity
    ? criticalActivity!
    : warningActivity!;

  const isCritical = triggeredActivity
    ? Number(triggeredActivity.value) === IncidentStatus.CRITICAL
    : false;

  console.log('CRITICAL ACTIVITY: ', criticalActivity);
  console.log('WARNING ACTIVITY: ', warningActivity);
  console.log('TRIGGERED ACTIVITY: ', triggeredActivity);

  // Find duration by looking at the difference between the previous and current activity timestamp
  const nextActivity = activities.find(
    activity => activity.previousValue === triggeredActivity.value
  );
  const activityDuration = (
    nextActivity ? moment(nextActivity.dateCreated) : moment()
  ).diff(moment(triggeredActivity.dateCreated), 'milliseconds');

  const triggerLabel = isCritical ? 'critical' : 'warning';
  const curentTrigger = incident.alertRule.triggers.find(
    trigger => trigger.label === triggerLabel
  );
  const timeWindow = getDuration(incident.alertRule.timeWindow * 60);
  const alertName = capitalize(
    AlertWizardAlertNames[getAlertTypeFromAggregateDataset(incident.alertRule)]
  );

  const activation = incident.activation;
  console.log('INCIDENT ACTIVATION: ', activation);

  return (
    <Fragment>
      <Cell>
        {triggeredActivity.value && (
          <StatusIndicator
            status={isCritical ? 'error' : 'warning'}
            tooltipTitle={t('Status: %s', isCritical ? t('Critical') : t('Warning'))}
          />
        )}
        <Link
          to={{
            pathname: alertDetailsLink(organization, incident),
            query: {alert: incident.identifier},
          }}
        >
          #{incident.identifier}
        </Link>
      </Cell>
      <Cell>
        {incident.alertRule.comparisonDelta ? (
          <Fragment>
            {alertName} {curentTrigger?.alertThreshold}%
            {t(
              ' %s in %s compared to the ',
              incident.alertRule.thresholdType === AlertRuleThresholdType.ABOVE
                ? t('higher')
                : t('lower'),
              timeWindow
            )}
            {COMPARISON_DELTA_OPTIONS.find(
              ({value}) => value === incident.alertRule.comparisonDelta
            )?.label ?? COMPARISON_DELTA_OPTIONS[0].label}
          </Fragment>
        ) : (
          <Fragment>
            {alertName}{' '}
            {incident.alertRule.thresholdType === AlertRuleThresholdType.ABOVE
              ? t('above')
              : t('below')}{' '}
            {curentTrigger?.alertThreshold} {t('in')} {timeWindow}
          </Fragment>
        )}
      </Cell>
      <Cell>
        {activityDuration &&
          getDynamicText({
            value: <Duration abbreviation seconds={activityDuration / 1000} />,
            fixed: '30s',
          })}
      </Cell>
      <Cell>
        <StyledDateTime
          date={getDynamicText({
            value: incident.dateCreated,
            fixed: 'Mar 4, 2022 10:44:13 AM UTC',
          })}
          year
          seconds
          timeZone
        />
      </Cell>
    </Fragment>
  );
}

export default MetricAlertActivity;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray300};
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)};
`;
