import {Fragment} from 'react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import {
  type Action,
  ActionCell,
} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {
  AutomationTitleCell,
  type AutomationTitleCellProps,
} from 'sentry/components/workflowEngine/gridCell/automationTitleCell';
import type {Monitor} from 'sentry/components/workflowEngine/gridCell/monitorsCell';
import {MonitorsCell} from 'sentry/components/workflowEngine/gridCell/monitorsCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import storyBook from 'sentry/stories/storyBook';

type ExampleAutomation = {
  action: Action[];
  automation: AutomationTitleCellProps;
  monitors: Monitor[];
  timeAgo: Date | null;
};

export default storyBook('Grid Cell Components', story => {
  const data: ExampleAutomation[] = [
    {
      automation: {
        id: '1',
        name: 'Slack suggested assignees',
        project: {slug: 'sentry', platform: 'python'},
      },
      action: ['slack'],
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
      automation: {
        id: '2',
        name: 'Send Discord notification',
        project: {slug: 'javascript', platform: 'javascript'},
      },
      action: ['discord'],
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
      automation: {
        id: '3',
        name: 'Email suggested assignees',
        project: {slug: 'javascript', platform: 'javascript'},
      },
      action: ['email'],
      timeAgo: new Date(Date.now() - 25 * 60 * 60 * 1000),
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
    {
      automation: {
        id: '4',
        name: 'Send notification',
        project: {slug: 'android', platform: 'android'},
      },
      action: ['slack', 'discord', 'email'],
      timeAgo: null,
      monitors: [],
    },
  ];

  const automationTitleTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'automation', name: 'Name', width: 200},
  ];

  const actionTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'action', name: 'Action', width: 200},
  ];

  const timeAgoTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'timeAgo', name: 'Last Triggered', width: 200},
  ];

  const monitorsTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'monitors', name: 'Connected Monitors', width: 200},
  ];

  const renderHeadCell = (column: GridColumnOrder) => column.name;

  const renderBodyCell = (
    column: GridColumnOrder<keyof ExampleAutomation>,
    dataRow: ExampleAutomation
  ) => {
    switch (column.key) {
      case 'automation':
        return (
          <AutomationTitleCell
            id={dataRow.automation.id}
            name={dataRow.automation.name}
            project={dataRow.automation.project}
          />
        );
      case 'action':
        return <ActionCell actions={dataRow.action} />;
      case 'timeAgo':
        return <TimeAgoCell date={dataRow.timeAgo ?? undefined} />;
      case 'monitors':
        return <MonitorsCell monitors={dataRow.monitors} />;
      default:
        return null;
    }
  };

  story('AutomationTitleCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={automationTitleTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));

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
