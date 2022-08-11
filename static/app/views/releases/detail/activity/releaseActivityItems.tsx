import styled from '@emotion/styled';

import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import TimeSince from 'sentry/components/timeSince';
import {IconExclamation, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

import {ReleaseActivityRow} from './releaseActivityRow';
import {
  ReleaseActivity,
  ReleaseActivityDeployed,
  ReleaseActivityIssue,
  ReleaseActivityType,
} from './types';

function ReleaseActivityStartStop(props: ReleaseActivityItemProps) {
  const isFinished = props.activity.type === ReleaseActivityType.FINISHED;
  return (
    <ReleaseActivityRow
      icon={<StyledIconSentry color="white" size="lg" />}
      iconColor="gray500"
      hideConnector={isFinished}
    >
      <div>
        {isFinished
          ? t('Release has been deployed for an hour and is no longer active')
          : t('Release Created')}
      </div>
      <DateContainer>
        <TimeSince date={props.activity.dateAdded} />
      </DateContainer>
    </ReleaseActivityRow>
  );
}

export function ReleaseActivityWaiting() {
  return (
    <ReleaseActivityRow
      icon={<StyledIconSentry color="white" size="lg" />}
      iconColor="gray500"
      hideConnector
    >
      <WaitingContainer>
        {t('Waiting for new issues in this release to notify release participants ...')}
      </WaitingContainer>
    </ReleaseActivityRow>
  );
}

interface ReleaseActivityDeployProps {
  activity: ReleaseActivityDeployed;
}

function ReleaseActivityDeploy(props: ReleaseActivityDeployProps) {
  return (
    <ReleaseActivityRow
      icon={<StyledIconSentry color="white" size="lg" />}
      iconColor="gray500"
    >
      <div>{t('Deployed to %s', props.activity.data.environment)}</div>
      <DateContainer>
        <TimeSince date={props.activity.dateAdded} />
      </DateContainer>
    </ReleaseActivityRow>
  );
}

interface ReleaseIssueActivityProps {
  activity: ReleaseActivityIssue;
}

function ReleaseIssueActivity(props: ReleaseIssueActivityProps) {
  const org = useOrganization();
  const group = props.activity.data.group;

  return (
    <ReleaseActivityRow
      icon={<IconExclamation color="white" size="lg" />}
      iconColor="yellow300"
    >
      <GroupSummary>
        <EventOrGroupHeader
          organization={org}
          data={group}
          query=""
          size="normal"
          includeLink
          hideLevel
        />
        <EventOrGroupExtraDetails data={group} showInboxTime={false} />
      </GroupSummary>
    </ReleaseActivityRow>
  );
}

interface ReleaseActivityItemProps {
  activity: ReleaseActivity;
}

export function ReleaseActivityItem(props: ReleaseActivityItemProps) {
  switch (props.activity.type) {
    case ReleaseActivityType.CREATED:
    case ReleaseActivityType.FINISHED:
      return <ReleaseActivityStartStop activity={props.activity} />;
    case ReleaseActivityType.DEPLOYED:
      return <ReleaseActivityDeploy activity={props.activity} />;
    case ReleaseActivityType.ISSUE:
      return <ReleaseIssueActivity activity={props.activity} />;
    default:
      return null;
  }
}

const DateContainer = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

// Fix sentry icon looking off center
const StyledIconSentry = styled(IconSentry)`
  margin-top: -${space(0.5)};
`;

const GroupSummary = styled('div')`
  overflow: hidden;
  flex: 1;
  margin-top: ${space(0.75)};
`;

const WaitingContainer = styled('div')`
  padding: ${space(1.5)} 0;
`;
