import * as React from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Client} from 'sentry/api';
import {SectionHeading} from 'sentry/components/charts/styles';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import {Panel, PanelBody} from 'sentry/components/panels';
import SeenByList from 'sentry/components/seenByList';
import TimeSince from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {IncidentRule} from 'sentry/views/alerts/incidentRules/types';
import {
  ActivityType,
  Incident,
  IncidentActivityType,
  IncidentStatus,
  IncidentStatusMethod,
} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';

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

type IncidentProps = {
  api: Client;
  incident: Incident;
  organization: Organization;
  rule: IncidentRule;
};

class TimelineIncident extends React.Component<IncidentProps> {
  renderActivity(activity: ActivityType, idx: number) {
    const {incident, rule} = this.props;
    const {activities} = incident;
    const last = activities && idx === activities.length - 1;
    const authorName = activity.user?.name ?? 'Sentry';

    const isDetected = activity.type === IncidentActivityType.DETECTED;
    const isStarted = activity.type === IncidentActivityType.STARTED;
    const isClosed =
      activity.type === IncidentActivityType.STATUS_CHANGE &&
      activity.value === `${IncidentStatus.CLOSED}`;
    const isTriggerChange =
      activity.type === IncidentActivityType.STATUS_CHANGE && !isClosed;

    // Unknown activity, don't render anything
    if (
      (!isStarted && !isDetected && !isClosed && !isTriggerChange) ||
      !activities ||
      !activities.length
    ) {
      return null;
    }

    const currentTrigger = getTriggerName(activity.value);

    let title: React.ReactNode;
    let subtext: React.ReactNode;
    if (isTriggerChange) {
      const nextActivity =
        activities.find(({previousValue}) => previousValue === activity.value) ||
        (activity.value &&
          activity.value === `${IncidentStatus.OPENED}` &&
          activities.find(({type}) => type === IncidentActivityType.DETECTED));
      const activityDuration = (
        nextActivity ? moment(nextActivity.dateCreated) : moment()
      ).diff(moment(activity.dateCreated), 'milliseconds');

      title = t('Alert status changed');
      subtext =
        activityDuration !== null &&
        tct(`[currentTrigger]: [duration]`, {
          currentTrigger,
          duration: <Duration abbreviation seconds={activityDuration / 1000} />,
        });
    } else if (isClosed && incident?.statusMethod === IncidentStatusMethod.RULE_UPDATED) {
      title = t('Alert auto-resolved');
      subtext = t('Alert rule modified or deleted');
    } else if (isClosed && incident?.statusMethod !== IncidentStatusMethod.RULE_UPDATED) {
      title = t('Resolved');
      subtext = tct('by [authorName]', {authorName});
    } else if (isDetected) {
      title = incident?.alertRule
        ? t('Alert was created')
        : tct('[authorName] created an alert', {authorName});
      subtext = <DateTime timeOnly date={activity.dateCreated} />;
    } else if (isStarted) {
      const dateEnded = moment(activity.dateCreated)
        .add(rule.timeWindow, 'minutes')
        .utc()
        .format();
      const timeOnly = Boolean(
        dateEnded && moment(activity.dateCreated).date() === moment(dateEnded).date()
      );

      title = t('Trigger conditions were met');
      subtext = (
        <React.Fragment>
          <DateTime
            timeOnly={timeOnly}
            timeAndDate={!timeOnly}
            date={activity.dateCreated}
          />
          {' — '}
          <DateTime timeOnly={timeOnly} timeAndDate={!timeOnly} date={dateEnded} />
        </React.Fragment>
      );
    } else {
      return null;
    }

    return (
      <Activity key={activity.id}>
        <ActivityTrack>{!last && <VerticalDivider />}</ActivityTrack>

        <ActivityBody>
          <ActivityTime>
            <StyledTimeSince date={activity.dateCreated} suffix={t('ago')} />
            <HorizontalDivider />
          </ActivityTime>
          <ActivityText>
            {title}
            {subtext && <ActivitySubText>{subtext}</ActivitySubText>}
          </ActivityText>
        </ActivityBody>
      </Activity>
    );
  }

  render() {
    const {incident, organization} = this.props;

    return (
      <IncidentSection key={incident.identifier}>
        <IncidentHeader>
          <Link
            to={{
              pathname: alertDetailsLink(organization, incident),
              query: {alert: incident.identifier},
            }}
          >
            {tct('Alert #[id]', {id: incident.identifier})}
          </Link>
          <SeenByTab>
            {incident && (
              <StyledSeenByList
                iconPosition="right"
                seenBy={incident.seenBy}
                iconTooltip={t('People who have viewed this alert')}
              />
            )}
          </SeenByTab>
        </IncidentHeader>
        {incident.activities && (
          <IncidentBody>
            {incident.activities
              .filter(activity => activity.type !== IncidentActivityType.COMMENT)
              .map((activity, idx) => this.renderActivity(activity, idx))}
          </IncidentBody>
        )}
      </IncidentSection>
    );
  }
}

type Props = {
  api: Client;
  organization: Organization;
  incidents?: Incident[];
  rule?: IncidentRule;
};

class Timeline extends React.Component<Props> {
  renderEmptyMessage = () => {
    return (
      <StyledEmptyStateWarning small withIcon={false}>
        <p>{t('No alerts triggered during this time')}</p>
      </StyledEmptyStateWarning>
    );
  };

  render() {
    const {api, incidents, organization, rule} = this.props;

    return (
      <History>
        <SectionHeading>{t('History')}</SectionHeading>
        <ScrollPanel>
          <PanelBody withPadding>
            {incidents && rule && incidents.length
              ? incidents.map(incident => (
                  <TimelineIncident
                    key={incident.identifier}
                    api={api}
                    organization={organization}
                    incident={incident}
                    rule={rule}
                  />
                ))
              : this.renderEmptyMessage()}
          </PanelBody>
        </ScrollPanel>
      </History>
    );
  }
}

export default Timeline;

const History = styled('div')`
  margin-bottom: 30px;
`;

const ScrollPanel = styled(Panel)`
  max-height: 500px;
  overflow: scroll;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  p {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  padding: 0;
`;

const IncidentSection = styled('div')`
  &:not(:first-of-type) {
    margin-top: 15px;
  }
`;

const IncidentHeader = styled('div')`
  display: flex;
  margin-bottom: ${space(1.5)};
`;

const SeenByTab = styled('div')`
  flex: 1;
  margin-left: ${space(2)};
  margin-right: 0;

  .nav-tabs > & {
    margin-right: 0;
  }
`;

const StyledSeenByList = styled(SeenByList)`
  margin-top: 0;
`;

const IncidentBody = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Activity = styled('div')`
  display: flex;
`;

const ActivityTrack = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: ${space(1)};

  &:before {
    content: '';
    width: ${space(1)};
    height: ${space(1)};
    background-color: ${p => p.theme.gray300};
    border-radius: ${space(1)};
  }
`;

const ActivityBody = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ActivityTime = styled('li')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.4;
`;

const StyledTimeSince = styled(TimeSince)`
  margin-right: ${space(1)};
`;

const ActivityText = styled('div')`
  flex-direction: row;
  margin-bottom: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ActivitySubText = styled('span')`
  display: inline-block;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-left: ${space(0.5)};
`;

const HorizontalDivider = styled('div')`
  flex: 1;
  height: 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  margin: 5px 0;
`;

const VerticalDivider = styled('div')`
  flex: 1;
  width: 0;
  margin: 0 5px;
  border-left: 1px dashed ${p => p.theme.innerBorder};
`;
