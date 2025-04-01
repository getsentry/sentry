import styled from '@emotion/styled';

import IssueStreamHeaderLabel from 'sentry/components/IssueStreamHeaderLabel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';

import type {GroupListColumn} from './groupList';

type Props = {
  withChart: boolean;
  withColumns?: GroupListColumn[];
};

function GroupListHeader({
  withChart = true,
  withColumns = ['graph', 'event', 'users', 'assignee', 'lastTriggered'],
}: Props) {
  return (
    <PanelHeader disablePadding>
      <IssueWrapper hideDivider>{t('Issue')}</IssueWrapper>
      {withColumns.includes('lastSeen') && (
        <LastSeenWrapper breakpoint={COLUMN_BREAKPOINTS.LAST_SEEN} align="right">
          {t('First Seen')}
        </LastSeenWrapper>
      )}
      {withColumns.includes('firstSeen') && (
        <AgeWrapper breakpoint={COLUMN_BREAKPOINTS.FIRST_SEEN} align="right">
          {t('Age')}
        </AgeWrapper>
      )}
      {withColumns.includes('lastTriggered') && (
        <LastTriggeredLabel align="right">{t('Last Triggered')}</LastTriggeredLabel>
      )}
      {withChart && (
        <GraphLabel breakpoint={COLUMN_BREAKPOINTS.TREND}>{t('Graph')}</GraphLabel>
      )}
      {withColumns.includes('event') && (
        <EventsOrUsersLabel breakpoint={COLUMN_BREAKPOINTS.EVENTS} align="right">
          {t('Events')}
        </EventsOrUsersLabel>
      )}
      {withColumns.includes('users') && (
        <EventsOrUsersLabel breakpoint={COLUMN_BREAKPOINTS.USERS} align="right">
          {t('Users')}
        </EventsOrUsersLabel>
      )}
      {withColumns.includes('priority') && (
        <PriorityLabel breakpoint={COLUMN_BREAKPOINTS.PRIORITY} align="right">
          {t('Priority')}
        </PriorityLabel>
      )}
      {withColumns.includes('assignee') && (
        <AssigneeLabel breakpoint={COLUMN_BREAKPOINTS.ASSIGNEE} align="right">
          {t('Assignee')}
        </AssigneeLabel>
      )}
    </PanelHeader>
  );
}

export default GroupListHeader;

const GroupListHeaderLabel = styled(IssueStreamHeaderLabel)`
  text-transform: capitalize;
`;

const IssueWrapper = styled(GroupListHeaderLabel)`
  flex: 1;
  padding-left: ${space(2)};
`;

const LastSeenWrapper = styled(GroupListHeaderLabel)`
  width: 80px;
`;

const AgeWrapper = styled(GroupListHeaderLabel)`
  width: 50px;
`;

const GraphLabel = styled(GroupListHeaderLabel)`
  width: 175px;
`;

const EventsOrUsersLabel = styled(GroupListHeaderLabel)`
  width: 60px;
`;

const PriorityLabel = styled(GroupListHeaderLabel)`
  width: 70px;
`;

const AssigneeLabel = styled(GroupListHeaderLabel)`
  width: 66px;
`;

const LastTriggeredLabel = styled(GroupListHeaderLabel)`
  width: 100px;
`;
