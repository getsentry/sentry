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
import Tooltip from 'sentry/components/tooltip';
import {IconShow} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
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

type Props = {
  organization: Organization;
  incidents?: Incident[];
};

function MetricHistory({organization, incidents}: Props) {
  const renderActivity = incident => {
    const activities = incident!.activities!.filter(
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
          <StatusLevel level={currentTrigger}>
            <Tooltip title={tct('Status: [level]', {level: currentTrigger})}>
              <span />
            </Tooltip>
          </StatusLevel>
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
            threshold:
              currentTrigger === 'Warning' ? warningThreshold : criticalThreshold,
          })}
        </Cell>
        <Cell>{threshold}</Cell>
        <Cell>
          <IconWrapper>
            <Tooltip title={t('People who have viewed this')} skipWrapper>
              <StyledIconShow size="xs" color="gray200" />
            </Tooltip>
            {incident.seenBy.length}
          </IconWrapper>
        </Cell>
        <StyledDateTime date={incident.dateCreated} />
      </ErrorBoundary>
    );
  };

  return (
    <CollapsePanel
      items={incidents!.length}
      collapseCount={COLLAPSE_COUNT}
      buttonTitle={tn(
        'Hidden Alert',
        'Hidden Alerts',
        incidents!.length - COLLAPSE_COUNT
      )}
    >
      {({isExpanded, showMoreButton}) => (
        <React.Fragment>
          <StyledPanelTable
            headers={[
              t('Alert'),
              t('Reason'),
              t('Duration'),
              t('Seen By'),
              t('Date Triggered'),
            ]}
            isEmpty={!incidents!.length}
            emptyMessage={t('No alerts triggered during this time.')}
            expanded={incidents!.length < COLLAPSE_COUNT || isExpanded}
          >
            {incidents!.map((incident, idx) => {
              if (idx >= COLLAPSE_COUNT && !isExpanded) {
                return null;
              }
              return renderActivity(incident);
            })}
          </StyledPanelTable>
          {incidents!.length > COLLAPSE_COUNT && (
            <ShowMoreButton expanded={isExpanded}>{showMoreButton}</ShowMoreButton>
          )}
        </React.Fragment>
      )}
    </CollapsePanel>
  );
}

export default MetricHistory;

const dateTimeCss = p => css`
  color: ${p.theme.gray300};
  font-size: ${p.theme.fontSizeMedium};
  display: flex;
  justify-content: center;
`;

const StyledPanelTable = styled(PanelTable)<{expanded: boolean; isEmpty: boolean}>`
  grid-template-columns: max-content 3fr repeat(3, max-content);

  ${p =>
    !p.expanded &&
    css`
      margin-bottom: 0px;
      border-bottom-left-radius: 0px;
      border-bottom-right-radius: 0px;
      border-bottom: none;
    `}
`;

const StatusLevel = styled('div')<{level: string}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p =>
    p.level === 'Warning'
      ? p.theme.alert.warning.background
      : p.theme.alert.error.background};

  & span {
    display: block;
    width: 9px;
    height: 15px;
  }
`;

const StyledDateTime = styled(DateTime)`
  ${dateTimeCss};
`;

const Title = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Cell = styled('div')`
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: end;
`;

const StyledIconShow = styled(IconShow)`
  margin-right: ${space(0.5)};
`;

const ShowMoreButton = styled('div')<{expanded: boolean}>`
  ${p =>
    !p.expanded &&
    css`
      border: 1px solid ${p.theme.border};
      border-top: none;
      border-bottom-left-radius: ${p.theme.borderRadius};
      border-bottom-right-radius: ${p.theme.borderRadius};
      margin-bottom: ${space(2)};
    `}
`;
