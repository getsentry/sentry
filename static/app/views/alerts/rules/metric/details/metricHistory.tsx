import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import CollapsePanel from 'sentry/components/collapsePanel';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {StatusIndicator} from 'sentry/components/statusIndicator';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import getDuration from 'sentry/utils/duration/getDuration';
import getDynamicText from 'sentry/utils/getDynamicText';
import {capitalize} from 'sentry/utils/string/capitalize';
import useOrganization from 'sentry/utils/useOrganization';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {AlertRuleThresholdType} from 'sentry/views/alerts/rules/metric/types';
import type {ActivityType, Incident} from 'sentry/views/alerts/types';
import {IncidentActivityType, IncidentStatus} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

const COLLAPSE_COUNT = 3;

type MetricAlertActivityProps = {
  incident: Incident;
  organization: Organization;
};

function MetricAlertActivity({organization, incident}: MetricAlertActivityProps) {
  const activities = (incident.activities ?? []).filter(
    activity => activity.type === IncidentActivityType.STATUS_CHANGE
  );
  const criticalActivity = activities.find(
    activity => activity.value === `${IncidentStatus.CRITICAL}`
  );
  const warningActivity = activities.find(
    activity => activity.value === `${IncidentStatus.WARNING}`
  );

  const triggeredActivity: ActivityType = criticalActivity
    ? criticalActivity
    : warningActivity!;
  const isCritical = Number(triggeredActivity.value) === IncidentStatus.CRITICAL;

  // Find duration by looking at the difference between the previous and current activity timestamp
  const nextActivity = activities.find(
    ({previousValue}) => previousValue === triggeredActivity.value
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
            )?.label ?? COMPARISON_DELTA_OPTIONS[0]?.label}
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

type Props = {
  incidents?: Incident[];
};

function MetricHistory({incidents}: Props) {
  const organization = useOrganization();
  const filteredIncidents = (incidents ?? []).filter(
    incident => incident.activities?.length
  );
  const numOfIncidents = filteredIncidents.length;

  return (
    <CollapsePanel
      items={numOfIncidents}
      collapseCount={COLLAPSE_COUNT}
      disableBorder={false}
      buttonTitle={tn('Hidden Alert', 'Hidden Alerts', numOfIncidents - COLLAPSE_COUNT)}
    >
      {({isExpanded, showMoreButton}) => (
        <div>
          <StyledPanelTable
            headers={[t('Alert'), t('Reason'), t('Duration'), t('Date Triggered')]}
            isEmpty={!numOfIncidents}
            emptyMessage={t('No alerts triggered during this time.')}
            expanded={numOfIncidents <= COLLAPSE_COUNT || isExpanded}
          >
            {filteredIncidents.map((incident, idx) => {
              if (idx >= COLLAPSE_COUNT && !isExpanded) {
                return null;
              }
              return (
                <MetricAlertActivity
                  key={idx}
                  incident={incident}
                  organization={organization}
                />
              );
            })}
          </StyledPanelTable>
          {showMoreButton}
        </div>
      )}
    </CollapsePanel>
  );
}

export default MetricHistory;

const StyledPanelTable = styled(PanelTable)<{expanded: boolean; isEmpty: boolean}>`
  grid-template-columns: max-content 1fr repeat(2, max-content);

  & > div {
    padding: ${space(1)} ${space(2)};
  }

  div:last-of-type {
    padding: ${p => p.isEmpty && `48px ${space(1)}`};
  }

  ${p =>
    !p.expanded &&
    css`
      margin-bottom: 0px;
      border-bottom-left-radius: 0px;
      border-bottom-right-radius: 0px;
      border-bottom: none;
    `}
`;

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
