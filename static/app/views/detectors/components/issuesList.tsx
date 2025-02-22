import {useState} from 'react';
import styled from '@emotion/styled';

import AssigneeSelectorDropdown from 'sentry/components/assigneeSelectorDropdown';
import GridEditable, {type GridColumnOrder} from 'sentry/components/gridEditable';
import {Grid} from 'sentry/components/gridEditable/styles';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import TimeSince from 'sentry/components/timeSince';
import type {Group} from 'sentry/types/group';

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
        data={[]}
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
