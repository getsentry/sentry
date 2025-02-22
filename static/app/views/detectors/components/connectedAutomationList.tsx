import {useState} from 'react';
import styled from '@emotion/styled';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import {Grid} from 'sentry/components/gridEditable/styles';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import type {Automation} from 'sentry/views/automations/components/automationListRow';

export function ConnectedAutomationsList() {
  const [activeRowKey, setActiveRowKey] = useState<number | undefined>(undefined);

  const columnOrder: Array<GridColumnOrder<keyof Automation>> = [
    {key: 'name', name: 'Name'},
    {key: 'lastTriggered', name: 'Last Triggered'},
    {key: 'actions', name: 'Action'},
  ];

  const renderHeadCell = (column: GridColumnOrder) => column.name;

  const renderBodyCell = (
    column: GridColumnOrder<keyof Automation>,
    dataRow: Automation
  ) => {
    switch (column.key) {
      case 'name':
        return (
          <TitleCell name={dataRow.name} project={dataRow.project} link={dataRow.link} />
        );
      case 'lastTriggered':
        return <TimeAgoCell date={dataRow.lastTriggered} />;
      case 'actions':
        return <ActionCell actions={dataRow.actions} />;
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
