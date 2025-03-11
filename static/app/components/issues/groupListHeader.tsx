import {Fragment} from 'react';
import styled from '@emotion/styled';

import IssueStreamHeaderLabel from 'sentry/components/IssueStreamHeaderLabel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';

import type {GroupListColumn} from './groupList';

type Props = {
  withChart: boolean;
  narrowGroups?: boolean;
  withColumns?: GroupListColumn[];
};

function GroupListHeader({
  withChart = true,
  narrowGroups = false,
  withColumns = ['graph', 'event', 'users', 'assignee', 'lastTriggered'],
}: Props) {
  const organization = useOrganization();

  const hasNewLayout = organization.features.includes('issue-stream-table-layout');

  return (
    <PanelHeader disablePadding>
      <IssueWrapper>{t('Issue')}</IssueWrapper>
      {hasNewLayout ? (
        <Fragment>
          {withColumns.includes('firstSeen') && (
            <FirstSeenWrapper breakpoint={COLUMN_BREAKPOINTS.FIRST_SEEN}>
              {t('First Seen')}
            </FirstSeenWrapper>
          )}
          {withColumns.includes('lastSeen') && (
            <LastSeenWrapper breakpoint={COLUMN_BREAKPOINTS.LAST_SEEN}>
              {t('Age')}
            </LastSeenWrapper>
          )}
          {withChart && (
            <NarrowGraphLabel breakpoint={COLUMN_BREAKPOINTS.TREND}>
              {t('Graph')}
            </NarrowGraphLabel>
          )}
          {withColumns.includes('event') && (
            <NarrowEventsOrUsersLabel breakpoint={COLUMN_BREAKPOINTS.EVENTS}>
              {t('events')}
            </NarrowEventsOrUsersLabel>
          )}
          {withColumns.includes('users') && (
            <NarrowEventsOrUsersLabel breakpoint={COLUMN_BREAKPOINTS.USERS}>
              {t('users')}
            </NarrowEventsOrUsersLabel>
          )}
          {withColumns.includes('priority') && (
            <NarrowPriorityLabel breakpoint={COLUMN_BREAKPOINTS.PRIORITY}>
              {t('Priority')}
            </NarrowPriorityLabel>
          )}
          {withColumns.includes('assignee') && (
            <NarrowAssigneeLabel breakpoint={COLUMN_BREAKPOINTS.ASSIGNEE}>
              {t('Assignee')}
            </NarrowAssigneeLabel>
          )}
          {withColumns.includes('lastTriggered') && (
            <NarrowLastTriggeredLabel>{t('Last Triggered')}</NarrowLastTriggeredLabel>
          )}
        </Fragment>
      ) : (
        <Fragment>
          {withChart && withColumns.includes('graph') && (
            <ChartWrapper narrowGroups={narrowGroups}>{t('Graph')}</ChartWrapper>
          )}
          {withColumns.includes('event') && (
            <EventUserWrapper>{t('events')}</EventUserWrapper>
          )}
          {withColumns.includes('users') && (
            <EventUserWrapper>{t('users')}</EventUserWrapper>
          )}
          {withColumns.includes('priority') && (
            <PriorityWrapper narrowGroups={narrowGroups}>{t('Priority')}</PriorityWrapper>
          )}
          {withColumns.includes('assignee') && (
            <AssigneeWrapper narrowGroups={narrowGroups}>{t('Assignee')}</AssigneeWrapper>
          )}
          {withColumns.includes('lastTriggered') && (
            <LastTriggeredWrapper>{t('Last Triggered')}</LastTriggeredWrapper>
          )}
        </Fragment>
      )}
    </PanelHeader>
  );
}

export default GroupListHeader;

const GroupListHeaderLabel = styled(IssueStreamHeaderLabel)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Heading = styled('div')`
  display: flex;
  align-self: center;
  margin: 0 ${space(2)};
  color: ${p => p.theme.subText};
`;

const IssueWrapper = styled(Heading)`
  flex: 1;
  width: 66.66%;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 50%;
  }
`;

const FirstSeenWrapper = styled(GroupListHeaderLabel)`
  width: 80px;
`;

const LastSeenWrapper = styled(GroupListHeaderLabel)`
  width: 50px;
`;

const EventUserWrapper = styled(Heading)`
  justify-content: flex-end;
  width: 60px;
  white-space: nowrap;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    width: 80px;
  }
`;

const LastTriggeredWrapper = styled(Heading)`
  justify-content: flex-end;
  width: 80px;
`;

const ChartWrapper = styled(Heading)<{narrowGroups: boolean}>`
  justify-content: space-between;
  width: 160px;

  @media (max-width: ${p =>
      p.narrowGroups ? p.theme.breakpoints.xxlarge : p.theme.breakpoints.xlarge}) {
    display: none;
  }
`;

const PriorityWrapper = styled(Heading)<{narrowGroups: boolean}>`
  justify-content: flex-end;
  width: 70px;

  @media (max-width: ${p =>
      p.narrowGroups ? p.theme.breakpoints.large : p.theme.breakpoints.medium}) {
    display: none;
  }
`;

const AssigneeWrapper = styled(Heading)<{narrowGroups: boolean}>`
  justify-content: flex-end;
  width: 60px;

  @media (max-width: ${p =>
      p.narrowGroups ? p.theme.breakpoints.large : p.theme.breakpoints.medium}) {
    display: none;
  }
`;

const NarrowGraphLabel = styled(GroupListHeaderLabel)`
  display: flex;
  justify-content: space-between;
  width: 175px;
`;

const NarrowEventsOrUsersLabel = styled(GroupListHeaderLabel)`
  display: flex;
  justify-content: space-between;
  width: 60px;
`;

const NarrowPriorityLabel = styled(GroupListHeaderLabel)`
  display: flex;
  justify-content: space-between;
  width: 70px;
`;

const NarrowAssigneeLabel = styled(GroupListHeaderLabel)`
  justify-content: flex-end;
  text-align: right;
  width: 60px;
`;

const NarrowLastTriggeredLabel = styled(GroupListHeaderLabel)`
  width: 80px;
  text-align: right;
  justify-content: flex-end;
`;
