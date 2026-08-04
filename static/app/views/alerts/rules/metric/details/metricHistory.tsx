import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Link} from '@sentry/scraps/link';

import {CollapsePanel} from 'sentry/components/collapsePanel';
import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {StatusIndicator} from 'sentry/components/statusIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useOrganization} from 'sentry/utils/useOrganization';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {AlertRuleThresholdType} from 'sentry/views/alerts/rules/metric/types';
import type {Incident} from 'sentry/views/alerts/types';
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

  const triggeredActivity = criticalActivity ? criticalActivity : warningActivity!;
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
    AlertWizardAlertNames[
      getAlertTypeFromAggregateDataset({...incident.alertRule, organization})
    ]
  );

  return (
    <SimpleTable.Row>
      <Cell>
        {triggeredActivity.value && (
          <StatusIndicator
            status={isCritical ? 'danger' : 'warning'}
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
              )?.label ?? COMPARISON_DELTA_OPTIONS[0]?.label}
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
              {curentTrigger?.alertThreshold} {t('in')} {timeWindow}
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
        {activityDuration && <Duration abbreviation seconds={activityDuration / 1000} />}
      </Cell>
      <Cell>
        <StyledDateTime date={incident.dateCreated} year seconds timeZone />
      </Cell>
    </SimpleTable.Row>
  );
}

type Props = {
  incidents?: Incident[];
};

export function MetricHistory({incidents}: Props) {
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
          <StyledSimpleTable
            expanded={numOfIncidents <= COLLAPSE_COUNT || isExpanded}
            header={
              <SimpleTable.HeaderRow>
                <SimpleTable.HeaderCell>{t('Alert')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Reason')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Duration')}</SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell>{t('Date Triggered')}</SimpleTable.HeaderCell>
              </SimpleTable.HeaderRow>
            }
          >
            {numOfIncidents ? (
              filteredIncidents.map((incident, idx) => {
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
              })
            ) : (
              <SimpleTable.Empty>
                {t('No alerts triggered during this time.')}
              </SimpleTable.Empty>
            )}
          </StyledSimpleTable>
          {showMoreButton}
        </div>
      )}
    </CollapsePanel>
  );
}

const StyledSimpleTable = styled(SimpleTable, {
  shouldForwardProp: prop => prop !== 'expanded',
})<{expanded: boolean}>`
  grid-template-columns: max-content 1fr repeat(2, max-content);

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
  color: ${p => p.theme.tokens.content.secondary};
`;

const Cell = styled(SimpleTable.RowCell)`
  white-space: nowrap;
  font-size: ${p => p.theme.font.size.md};
  padding: ${p => p.theme.space.md};
`;
