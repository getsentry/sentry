import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {fetchIncidentActivities} from 'app/actionCreators/incident';
import {Client} from 'app/api';
import DateTime from 'app/components/dateTime';
import Duration from 'app/components/duration';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import NavTabs from 'app/components/navTabs';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SeenByList from 'app/components/seenByList';
import TimeSince from 'app/components/timeSince';
import {IconCheckmark, IconEllipse, IconFire, IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {getTriggerName} from 'app/views/alerts/details/activity/statusItem';
import {
  ActivityType,
  Incident,
  IncidentActivityType,
  IncidentStatus,
  IncidentStatusMethod,
} from 'app/views/alerts/types';
import {IncidentRule} from 'app/views/settings/incidentRules/types';

type Activities = Array<ActivityType>;

type IncidentProps = {
  api: Client;
  orgId: string;
  incident: Incident;
  rule: IncidentRule;
};

type IncidentState = {
  loading: boolean;
  error: boolean;
  activities: null | Activities;
};

class TimelineIncident extends React.Component<IncidentProps, IncidentState> {
  state: IncidentState = {
    loading: true,
    error: false,
    activities: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: IncidentProps) {
    // Only refetch if incidentStatus changes.
    //
    // This component can mount before incident details is fully loaded.
    // In which case, `incidentStatus` is null and we will be fetching via `cDM`
    // There's no need to fetch this gets updated due to incident details being loaded
    if (
      prevProps.incident.status !== null &&
      prevProps.incident.status !== this.props.incident.status
    ) {
      this.fetchData();
    }
  }

  async fetchData() {
    const {api, orgId, incident} = this.props;

    try {
      const activities = await fetchIncidentActivities(api, orgId, incident.id);
      this.setState({activities, loading: false});
    } catch (err) {
      this.setState({loading: false, error: !!err});
    }
  }

  renderActivity(activity: ActivityType, idx) {
    const {incident, rule} = this.props;
    const {activities} = this.state;
    const last = this.state.activities && idx === this.state.activities.length - 1;
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
      const activityDuration = (nextActivity
        ? moment(nextActivity.dateCreated)
        : moment()
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
      subtext = t('Alert rule has been modified or deleted');
    } else if (isClosed && incident?.statusMethod !== IncidentStatusMethod.RULE_UPDATED) {
      title = t('Alert resolved');
      subtext = tct('by [authorName]', {authorName});
    } else if (isDetected) {
      const nextActivity = activities.find(({previousValue}) => previousValue === '1');
      const activityDuration = nextActivity
        ? moment(nextActivity.dateCreated).diff(
            moment(activity.dateCreated),
            'milliseconds'
          )
        : null;

      title = incident?.alertRule
        ? t('Alert was created')
        : tct('[authorName] created an alert', {authorName});
      subtext =
        activityDuration !== null &&
        tct(`Critical: [duration]`, {
          duration: <Duration abbreviation seconds={activityDuration / 1000} />,
        });
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
        <ActivityTrack>
          <IconEllipse size="sm" color="gray300" />
          {!last && <VerticalDivider />}
        </ActivityTrack>

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
    const {incident} = this.props;
    const {activities} = this.state;

    let Icon = IconCheckmark;
    let color: string = theme.green300;

    if (
      activities &&
      activities.find(
        activity =>
          activity.type === IncidentActivityType.DETECTED ||
          (activity.type === IncidentActivityType.STATUS_CHANGE &&
            activity.value === `${IncidentStatus.CRITICAL}`)
      )
    ) {
      Icon = IconFire;
      color = theme.red300;
    } else if (
      activities &&
      activities.find(
        activity =>
          activity.type === IncidentActivityType.STARTED ||
          (activity.type === IncidentActivityType.STATUS_CHANGE &&
            activity.value === `${IncidentStatus.CRITICAL}`)
      )
    ) {
      Icon = IconWarning;
      color = theme.yellow300;
    }

    return (
      <StyledNavTabs key={incident.identifier}>
        <IncidentHeader>
          <AlertBadge color={color} icon={Icon}>
            <IconWrapper>
              <Icon color="white" size="xs" />
            </IconWrapper>
          </AlertBadge>
          <li>{tct('Alert #[id]', {id: incident.identifier})}</li>
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
        {activities && (
          <IncidentBody>
            {activities
              .filter(activity => activity.type !== IncidentActivityType.COMMENT)
              .map((activity, idx) => this.renderActivity(activity, idx))}
          </IncidentBody>
        )}
      </StyledNavTabs>
    );
  }
}

type Props = {
  api: Client;
  rule?: IncidentRule;
  orgId: string;
  incidents?: Incident[];
};

class Timeline extends React.Component<Props> {
  renderEmptyMessage = () => {
    return (
      <EmptyStateWarning small withIcon={false}>
        {t('No alerts have been triggered yet')}
      </EmptyStateWarning>
    );
  };

  render() {
    const {api, incidents, orgId, rule} = this.props;

    return (
      <Panel>
        <PanelHeader>{t('Timeline')}</PanelHeader>
        <PanelBody>
          {incidents && rule && incidents.length
            ? incidents.map(incident => (
                <TimelineIncident
                  key={incident.identifier}
                  api={api}
                  orgId={orgId}
                  incident={incident}
                  rule={rule}
                />
              ))
            : this.renderEmptyMessage()}
        </PanelBody>
      </Panel>
    );
  }
}

export default Timeline;

const StyledNavTabs = styled(NavTabs)`
  display: flex;
  flex-direction: column;
  margin: ${space(2)};
`;

const IncidentHeader = styled('div')`
  display: flex;
  margin-bottom: ${space(1.5)};
`;

const AlertBadge = styled('div')<{color: string; icon: React.ReactNode}>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* icon warning needs to be treated differently to look visually centered */
  line-height: ${p => (p.icon === IconWarning ? undefined : 1)};
  margin-right: ${space(1.5)};

  &:before {
    content: '';
    width: 16px;
    height: 16px;
    border-radius: ${p => p.theme.borderRadius};
    background-color: ${p => p.color};
    transform: rotate(45deg);
  }
`;

const IconWrapper = styled('div')`
  position: absolute;
`;

const SeenByTab = styled('li')`
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
  margin-right: ${space(1.5)};
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
  margin-bottom: ${space(1)};
`;

const StyledTimeSince = styled(TimeSince)`
  margin-right: ${space(1)};
`;

const ActivityText = styled('div')`
  margin-bottom: ${space(2)};
`;

const ActivitySubText = styled('div')`
  display: flex;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
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
