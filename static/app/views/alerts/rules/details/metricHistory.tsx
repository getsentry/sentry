import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import CollapsePanel from 'sentry/components/collapsePanel';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Link from 'sentry/components/links/link';
import PanelTable from 'sentry/components/panels/panelTable';
import StatusIndicator from 'sentry/components/statusIndicator';
import Tooltip from 'sentry/components/tooltip';
import {IconShow} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {AlertRuleThresholdType} from 'sentry/views/alerts/incidentRules/types';
import {Incident, IncidentActivityType, IncidentStatus} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

const COLLAPSE_COUNT = 3;

export function getTriggerName(value: string | null) {
  if (value === `${IncidentStatus.WARNING}`) {
    return t('Warning');
  }

  if (value === `${IncidentStatus.CRITICAL}`) {
    return t('Critical');
  }

  // Otherwise, activity type is not status change
  return '';
}

type MetricAlertActivityProps = {
  incident: Incident;
  organization: Organization;
};

function MetricAlertActivity({organization, incident}: MetricAlertActivityProps) {
  const activities = (incident.activities ?? []).filter(
    activity => activity.type === IncidentActivityType.STATUS_CHANGE
  );
  const criticalActivity = activities.filter(
    activity => activity.value === `${IncidentStatus.CRITICAL}`
  );
  const warningActivity = activities.filter(
    activity => activity.value === `${IncidentStatus.WARNING}`
  );

  const triggeredActivity = !!criticalActivity.length
    ? criticalActivity[0]
    : warningActivity[0];
  const currentTrigger = getTriggerName(triggeredActivity.value);

  const nextActivity = activities.find(
    ({previousValue}) => previousValue === triggeredActivity.value
  );

  const activityDuration = (
    nextActivity ? moment(nextActivity.dateCreated) : moment()
  ).diff(moment(triggeredActivity.dateCreated), 'milliseconds');

  const threshold =
    activityDuration !== null &&
    tct('[duration]', {
      duration: <Duration abbreviation seconds={activityDuration / 1000} />,
    });

  const warningThreshold = incident.alertRule.triggers
    .filter(trigger => trigger.label === 'warning')
    .map(trig => trig.alertThreshold);
  const criticalThreshold = incident.alertRule.triggers
    .filter(trigger => trigger.label === 'critical')
    .map(trig => trig.alertThreshold);

  return (
    <ErrorBoundary>
      <Title data-test-id="alert-title">
        <StatusIndicator
          status={currentTrigger.toLocaleLowerCase()}
          tooltipTitle={tct('Status: [level]', {level: currentTrigger})}
        />
        <Link
          to={{
            pathname: alertDetailsLink(organization, incident),
            query: {alert: incident.identifier},
          }}
        >
          {tct('#[id]', {id: incident.identifier})}
        </Link>
      </Title>
      <Cell>
        {tct('[title] [selector] [threshold]', {
          title:
            AlertWizardAlertNames[getAlertTypeFromAggregateDataset(incident.alertRule)],
          selector:
            incident.alertRule.thresholdType === AlertRuleThresholdType.ABOVE
              ? 'above'
              : 'below',
          threshold: currentTrigger === 'Warning' ? warningThreshold : criticalThreshold,
        })}
      </Cell>
      <Cell>{threshold}</Cell>
      <SeenByCell>
        <IconWrapper>
          <Tooltip title={t('People who have viewed this')} skipWrapper>
            <StyledIconShow size="xs" color="gray200" />
          </Tooltip>
          {incident.seenBy.length}
        </IconWrapper>
      </SeenByCell>
      <StyledDateTime
        date={getDynamicText({
          value: incident.dateCreated,
          fixed: 'Mar 4, 2022 10:44:13 AM UTC',
        })}
      />
    </ErrorBoundary>
  );
}

type Props = {
  organization: Organization;
  incidents?: Incident[];
};

function MetricHistory({organization, incidents}: Props) {
  const numOfIncidents = (incidents ?? []).length;

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
            headers={[
              t('Alert'),
              t('Reason'),
              t('Duration'),
              t('Seen By'),
              t('Date Triggered'),
            ]}
            isEmpty={!numOfIncidents}
            emptyMessage={t('No alerts triggered during this time.')}
            expanded={numOfIncidents <= COLLAPSE_COUNT || isExpanded}
          >
            {incidents &&
              incidents.map((incident, idx) => {
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
  grid-template-columns: max-content 3fr repeat(3, max-content);

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
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  justify-content: flex-start;
  padding: ${space(1)} ${space(2)} !important;
`;

const Title = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)};
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)};
`;

const SeenByCell = styled(Cell)`
  justify-content: flex-end;
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: end;
`;

const StyledIconShow = styled(IconShow)`
  margin-right: ${space(0.5)};
`;
