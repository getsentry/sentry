import styled from '@emotion/styled';

import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

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

  return (
    <PanelHeader disablePadding>
      <IssueWrapper>{t('Issue')}</IssueWrapper>
      {withChart && withColumns.includes('graph') && (
        <ChartWrapper narrowGroups={narrowGroups}>{t('Graph')}</ChartWrapper>
      )}
      {withColumns.includes('event') && (
        <EventUserWrapper>{t('events')}</EventUserWrapper>
      )}
      {withColumns.includes('users') && <EventUserWrapper>{t('users')}</EventUserWrapper>}
      {withColumns.includes('priority') &&
        organization.features.includes('issue-priority-ui') && (
          <PriorityWrapper narrowGroups={narrowGroups}>{t('Priority')}</PriorityWrapper>
        )}
      {withColumns.includes('assignee') && (
        <AssigneeWrapper narrowGroups={narrowGroups}>{t('Assignee')}</AssigneeWrapper>
      )}
      {withColumns.includes('lastTriggered') && (
        <EventUserWrapper>{t('Last Triggered')}</EventUserWrapper>
      )}
    </PanelHeader>
  );
}

export default GroupListHeader;

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

const EventUserWrapper = styled(Heading)`
  justify-content: flex-end;
  width: 60px;
  white-space: nowrap;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    width: 80px;
  }
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
