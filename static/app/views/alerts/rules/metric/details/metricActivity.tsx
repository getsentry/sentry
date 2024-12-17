import {Fragment, type ReactElement} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import Duration from 'sentry/components/duration';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import Link from 'sentry/components/links/link';
import {StatusIndicator} from 'sentry/components/statusIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ActivationConditionType} from 'sentry/types/alerts';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import getDynamicText from 'sentry/utils/getDynamicText';
import {capitalize} from 'sentry/utils/string/capitalize';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {StyledDateTime} from 'sentry/views/alerts/rules/metric/details/styles';
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
  const activities: ActivityType[] = (incident.activities ?? []).filter(
    activity => activity.type === IncidentActivityType.STATUS_CHANGE
  );

  const statusValues = [String(IncidentStatus.CRITICAL), String(IncidentStatus.WARNING)];
  // TODO: kinda cheating with the forced `!`. Is there a better way to type this?
  const latestActivity: ActivityType = activities.find(activity =>
    statusValues.includes(String(activity.value))
  )!;

  const isCritical = Number(latestActivity.value) === IncidentStatus.CRITICAL;

  // Find the _final_ most recent activity _after_ our triggered activity
  // This exists for the `CLOSED` state (or any state NOT WARNING/CRITICAL)
  const finalActivity = activities.find(
    activity => activity.previousValue === latestActivity.value
  );
  const activityDuration = (
    finalActivity ? moment(finalActivity.dateCreated) : moment()
  ).diff(moment(latestActivity.dateCreated), 'milliseconds');

  const triggerLabel = isCritical ? 'critical' : 'warning';
  const curentTrigger = incident.alertRule.triggers.find(
    trigger => trigger.label === triggerLabel
  );
  const timeWindow = getDuration(incident.alertRule.timeWindow * 60);
  const alertName = capitalize(
    AlertWizardAlertNames[getAlertTypeFromAggregateDataset(incident.alertRule)]
  );

  const project = incident.alertRule.projects[0];
  const activation = incident.activation;
  let activationBlock: ReactElement | null = null;
  // TODO: Split this string check into a separate component
  if (activation) {
    let condition;
    let activator;
    switch (activation.conditionType) {
      case String(ActivationConditionType.RELEASE_CREATION):
        condition = 'Release';
        activator = (
          <GlobalSelectionLink
            to={{
              pathname: `/organizations/${
                organization.slug
              }/releases/${encodeURIComponent(activation.activator)}/`,
              query: {project},
            }}
            style={{textOverflow: 'ellipsis', overflowX: 'inherit'}}
          >
            {activation.activator}
          </GlobalSelectionLink>
        );
        break;
      case String(ActivationConditionType.DEPLOY_CREATION):
        condition = 'Deploy';
        activator = activation.activator;
        break;
      default:
        condition = '--';
    }
    activationBlock = (
      <Fragment>
        &nbsp;from {condition}&nbsp;{activator}
      </Fragment>
    );
  }

  return (
    <Fragment>
      <Cell>
        {latestActivity.value && (
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
        {/* If an alert rule is a % comparison based detection type */}
        {incident.alertRule.detectionType !== 'dynamic' &&
          incident.alertRule.comparisonDelta && (
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
          )}
        {/* If an alert rule is a static detection type */}
        {incident.alertRule.detectionType !== 'dynamic' &&
          !incident.alertRule.comparisonDelta && (
            <Fragment>
              {alertName}{' '}
              {incident.alertRule.thresholdType === AlertRuleThresholdType.ABOVE
                ? t('above')
                : t('below')}{' '}
              {curentTrigger?.alertThreshold || '_'} {t('within')} {timeWindow}
              {activationBlock}
            </Fragment>
          )}
        {/* If an alert rule is a dynamic detection type */}
        {incident.alertRule.detectionType === 'dynamic' && (
          <Fragment>
            {t('Detected an anomaly in the query for ')}
            {alertName}
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

const Cell = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)};
  overflow-x: hidden;
`;
