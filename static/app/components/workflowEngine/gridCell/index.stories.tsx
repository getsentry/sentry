import {Fragment} from 'react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import type {Monitor} from 'sentry/components/workflowEngine/gridCell/monitorsCell';
import GridEditable from 'sentry/components/gridEditable';
import {Action, ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {MonitorsCell} from 'sentry/components/workflowEngine/gridCell/monitorsCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import storyBook from 'sentry/stories/storyBook';

type ExampleDataItem = {
  action: Action[];
  monitors: Monitor[];
  timeAgo: Date;
};

export default storyBook('Grid Cell Components', story => {
  const data: ExampleDataItem[] = [
    {
      action: [Action.SLACK],
      timeAgo: new Date(),
      monitors: [
        {
          name: 'my monitor',
          id: 'abc123',
          project: {slug: 'ngrok-luver', platform: 'ruby'},
        },
      ],
    },
    {
      action: [Action.SLACK, Action.DISCORD, Action.EMAIL],
      timeAgo: new Date(Date.now() - 2 * 60 * 60 * 1000),
      monitors: [
        {
          name: '/endpoint',
          id: 'def456',
          project: {slug: 'javascript', platform: 'javascript'},
          description: 'transaction.duration',
        },
        {
          name: '/checkout',
          id: 'ghi789',
          project: {slug: 'javascript', platform: 'javascript'},
          description: 'transaction.duration',
        },
      ],
    },
    {
      action: [Action.EMAIL],
      timeAgo: new Date(Date.now() - 5 * 60 * 60 * 1000),
      monitors: [
        {
          name: 'test monitor',
          id: 'jkl012',
          project: {slug: 'bruh', platform: 'android'},
          description: 'transaction.duration',
        },
        {
          name: 'test python monitor',
          id: 'mno345',
          project: {slug: 'bruh.py', platform: 'python'},
        },
        {
          name: 'test swift monitor',
          id: 'pqr678',
          project: {slug: 'bruh.swift', platform: 'swift'},
        },
      ],
    },
  ];

  const actionTable: GridColumnOrder<keyof ExampleDataItem>[] = [
    {key: 'action', name: 'Action', width: 200},
  ];

  const timeAgoTable: GridColumnOrder<keyof ExampleDataItem>[] = [
    {key: 'timeAgo', name: 'Last Triggered', width: 200},
  ];

  const monitorsTable: GridColumnOrder<keyof ExampleDataItem>[] = [
    {key: 'monitors', name: 'Connected Monitors', width: 200},
  ];

  const renderHeadCell = (column: GridColumnOrder) => column.name;

  const renderBodyCell = (
    column: GridColumnOrder<keyof ExampleDataItem>,
    dataRow: ExampleDataItem
  ) => {
    switch (column.key) {
      case 'action':
        return <ActionCell actions={dataRow.action} />;
      case 'timeAgo':
        return <TimeAgoCell date={dataRow.timeAgo} />;
      case 'monitors':
        return <MonitorsCell monitors={dataRow.monitors} />;
      default:
        return null;
    }
  };

  story('ActionCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={actionTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));

  story('TimeAgoCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={timeAgoTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));

  story('MonitorsCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={monitorsTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));
});
