import {Fragment} from 'react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import {
  type Action,
  ActionCell,
} from 'sentry/components/workflowEngine/gridCell/actionCell';
import {
  ConnectionCell,
  type ConnectionCellProps,
} from 'sentry/components/workflowEngine/gridCell/connectionCell';
import {NumberCell} from 'sentry/components/workflowEngine/gridCell/numberCell';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {
  TitleCell,
  type TitleCellProps,
} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {tn} from 'sentry/locale';
import storyBook from 'sentry/stories/storyBook';

type ExampleAutomation = {
  action: Action[];
  linkedItems: ConnectionCellProps;
  openIssues: number;
  timeAgo: Date | null;
  title: TitleCellProps;
};

export default storyBook('Grid Cell Components', story => {
  const data: ExampleAutomation[] = [
    {
      title: {
        name: 'Slack suggested assignees',
        project: {slug: 'sentry', platform: 'python'},
        link: '/monitors/1',
      },
      action: ['slack'],
      timeAgo: new Date(),
      linkedItems: {
        items: [
          {
            name: 'my monitor',
            project: {slug: 'ngrok-luver', platform: 'ruby'},
            link: 'monitors/abc123',
          },
        ],
        renderText: count => tn('%s monitor', '%s monitors', count),
      },
      openIssues: 3,
    },
    {
      title: {
        name: 'Send Discord notification',
        project: {
          slug: 'javascript',
          platform: 'javascript',
        },
        details: ['transaction.duration', '2s warn, 2.5s critical threshold'],
        link: '/monitors/2',
      },
      action: ['discord'],
      timeAgo: new Date(Date.now() - 2 * 60 * 60 * 1000),
      linkedItems: {
        items: [
          {
            name: '/endpoint',
            project: {slug: 'javascript', platform: 'javascript'},
            description: 'transaction.duration',
            link: 'monitors/def456',
          },
          {
            name: '/checkout',
            project: {slug: 'javascript', platform: 'javascript'},
            description: 'transaction.duration',
            link: 'monitors/ghi789',
          },
        ],
        renderText: count => tn('%s monitor', '%s monitors', count),
      },
      openIssues: 1,
    },
    {
      title: {
        name: 'Email suggested assignees',
        project: {slug: 'javascript', platform: 'javascript'},
        details: ['Every hour'],
        link: '/monitors/3',
      },
      action: ['email'],
      timeAgo: new Date(Date.now() - 25 * 60 * 60 * 1000),
      linkedItems: {
        items: [
          {
            name: 'test automation',
            project: {slug: 'bruh', platform: 'android'},
            description: 'transaction.duration',
            link: 'automations/jkl012',
          },
          {
            name: 'test python automation',
            project: {slug: 'bruh.py', platform: 'python'},
            link: 'automations/mno345',
          },
          {
            name: 'test swift automation',
            project: {slug: 'bruh.swift', platform: 'swift'},
            link: 'automations/pqr678',
          },
        ],
        renderText: count => tn('%s automation', '%s automations', count),
      },
      openIssues: 0,
    },
    {
      title: {
        name: 'Send notification',
        project: {slug: 'android', platform: 'android'},
        link: '/monitors/4',
        disabled: true,
      },
      action: ['slack', 'discord', 'email'],
      timeAgo: null,
      linkedItems: {
        items: [],
        renderText: count => tn('%s automation', '%s automations', count),
      },
      openIssues: 0,
    },
  ];

  const TitleTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'title', name: 'Name', width: 200},
  ];

  const actionTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'action', name: 'Action', width: 200},
  ];

  const timeAgoTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'timeAgo', name: 'Last Triggered', width: 200},
  ];

  const linkedGroupsTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'linkedItems', name: 'Connected Monitors/Automations', width: 200},
  ];

  const openIssuesTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'openIssues', name: 'Open Issues', width: 200},
  ];

  const renderHeadCell = (column: GridColumnOrder) => column.name;

  const renderBodyCell = (
    column: GridColumnOrder<keyof ExampleAutomation>,
    dataRow: ExampleAutomation
  ) => {
    switch (column.key) {
      case 'title':
        return (
          <TitleCell
            link={dataRow.title.link}
            name={dataRow.title.name}
            project={dataRow.title.project}
            details={dataRow.title.details}
            disabled={dataRow.title.disabled}
          />
        );
      case 'action':
        return <ActionCell actions={dataRow.action} />;
      case 'timeAgo':
        return <TimeAgoCell date={dataRow.timeAgo ?? undefined} />;
      case 'linkedItems':
        return (
          <ConnectionCell
            items={dataRow.linkedItems.items}
            renderText={dataRow.linkedItems.renderText}
          />
        );
      case 'openIssues':
        return <NumberCell number={dataRow.openIssues} />;
      default:
        return null;
    }
  };

  story('TitleCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={TitleTable}
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

  story('ConnectionCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={linkedGroupsTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));

  story('NumberCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={openIssuesTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));
});
