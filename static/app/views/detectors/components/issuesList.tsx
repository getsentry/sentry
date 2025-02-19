import {useState} from 'react';
import styled from '@emotion/styled';

import AssigneeSelectorDropdown from 'sentry/components/assigneeSelectorDropdown';
import GridEditable, {type GridColumnOrder} from 'sentry/components/gridEditable';
import {Grid} from 'sentry/components/gridEditable/styles';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import TimeSince from 'sentry/components/timeSince';
import {EventOrGroupType} from 'sentry/types/event';
import {
  type Group,
  GroupStatus,
  type GroupUnresolved,
  IssueCategory,
  IssueType,
  PriorityLevel,
} from 'sentry/types/group';

const unresolvedGroup: GroupUnresolved = {
  activity: [],
  annotations: [],
  assignedTo: null,
  count: '327482',
  culprit: 'fetchData(app/components/group/suggestedOwners/suggestedOwners)',
  firstSeen: '2019-04-05T19:44:05.963Z',
  filtered: null,
  hasSeen: false,
  id: '1',
  isBookmarked: false,
  isPublic: false,
  isSubscribed: false,
  isUnhandled: false,
  issueCategory: IssueCategory.ERROR,
  issueType: IssueType.ERROR,
  lastSeen: '2019-04-11T01:08:59Z',
  level: 'warning',
  logger: null,
  metadata: {function: 'fetchData', type: 'RequestError'},
  numComments: 0,
  participants: [],
  permalink: 'https://foo.io/organizations/foo/issues/1234/',
  platform: 'javascript',
  pluginActions: [],
  pluginContexts: [],
  pluginIssues: [],
  priority: PriorityLevel.MEDIUM,
  priorityLockedAt: null,
  project: {
    platform: 'javascript',
  },
  seenBy: [],
  shareId: '',
  shortId: 'JAVASCRIPT-6QS',
  stats: {
    '24h': [
      [1517281200, 2],
      [1517310000, 1],
    ],
    '30d': [
      [1514764800, 1],
      [1515024000, 122],
    ],
  },
  status: GroupStatus.UNRESOLVED,
  statusDetails: {},
  subscriptionDetails: null,
  title: 'RequestError: GET /issues/ 404',
  type: EventOrGroupType.ERROR,
  userCount: 35097,
  userReportCount: 0,
};

function IssuesList() {
  const [activeRowKey, setActiveRowKey] = useState<number | undefined>(undefined);

  const columnOrder: Array<GridColumnOrder<keyof Group>> = [
    {key: 'title', name: 'Issue'},
    {key: 'lastSeen', name: 'Age'},
    {key: 'assignedTo', name: 'Assignee'},
  ];

  const renderHeadCell = (column: GridColumnOrder) => column.name;

  const renderBodyCell = (column: GridColumnOrder<keyof Group>, dataRow: Group) => {
    switch (column.key) {
      case 'title':
        return (
          <GroupSummary
            group={dataRow}
            event={dataRow.latestEvent}
            project={dataRow.project}
          />
        );
      case 'lastSeen':
        return <TimeSince date={dataRow.lastSeen} unitStyle="extraShort" suffix="" />;
      case 'assignedTo':
        return <StyledAssigneeSelectorDropdown group={dataRow} loading={false} />;
      default:
        return null;
    }
  };

  return (
    <Wrapper>
      <GridEditable
        data={[unresolvedGroup, unresolvedGroup]}
        columnOrder={columnOrder}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
        onRowMouseOver={(_dataRow, key) => {
          setActiveRowKey(key);
        }}
        onRowMouseOut={() => {
          setActiveRowKey(undefined);
        }}
        highlightedRowKey={activeRowKey}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  ${Grid} {
    grid-template-columns: 3fr 1fr 1fr !important;
  }
`;

const StyledAssigneeSelectorDropdown = styled(AssigneeSelectorDropdown)`
  justify-content: flex-start !important;
`;

export default IssuesList;
