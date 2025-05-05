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
import {
  TypeCell,
  type TypeCellProps,
} from 'sentry/components/workflowEngine/gridCell/typeCell';
import {
  UserCell,
  type UserCellProps,
} from 'sentry/components/workflowEngine/gridCell/userCell';
import storyBook from 'sentry/stories/storyBook';

type ExampleAutomation = {
  action: Action[];
  creator: UserCellProps['user'];
  linkedItems: ConnectionCellProps;
  openIssues: number;
  timeAgo: Date | null;
  title: TitleCellProps;
  type: TypeCellProps['type'];
};

export default storyBook('Grid Cell Components', story => {
  const data: ExampleAutomation[] = [
    {
      title: {
        name: 'Slack suggested assignees',
        projectId: '1',
        link: '/issues/monitors/1',
      },
      action: ['slack'],
      timeAgo: new Date(),
      linkedItems: {
        ids: ['abc123'],
        type: 'workflow',
      },
      openIssues: 3,
      creator: '1',
      type: 'trace',
    },
    {
      title: {
        name: 'Send Discord notification',
        projectId: '1',
        details: ['transaction.duration', '2s warn, 2.5s critical threshold'],
        link: '/issues/monitors/2',
      },
      action: ['discord'],
      timeAgo: new Date(Date.now() - 2 * 60 * 60 * 1000),
      linkedItems: {
        ids: ['abc123', 'def456', 'ghi789'],
        type: 'detector',
      },
      openIssues: 1,
      creator: '1',
      type: 'metric',
    },
    {
      title: {
        name: 'Email suggested assignees',
        projectId: '1',
        details: ['Every hour'],
        link: '/issues/monitors/3',
      },
      action: ['email'],
      timeAgo: new Date(Date.now() - 25 * 60 * 60 * 1000),
      linkedItems: {
        ids: ['abc123', 'def456'],
        type: 'workflow',
      },
      creator: 'sentry',
      type: 'uptime',
      openIssues: 0,
    },
    {
      title: {
        name: 'Send notification',
        projectId: '1',
        link: '/issues/monitors/4',
        disabled: true,
      },
      action: ['slack', 'discord', 'email'],
      creator: 'sentry',
      type: 'errors',
      timeAgo: null,
      linkedItems: {
        ids: [],
        type: 'detector',
      },
      openIssues: 0,
    },
  ];

  const TitleTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'title', name: 'Name', width: 200},
  ];

  const typeTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'type', name: 'Type', width: 150},
  ];

  const actionTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'action', name: 'Action', width: 200},
  ];

  const timeAgoTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'timeAgo', name: 'Last Triggered', width: 200},
  ];

  const userTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'creator', name: 'User', width: 150},
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
            projectId={dataRow.title.projectId}
            details={dataRow.title.details}
            disabled={dataRow.title.disabled}
          />
        );
      case 'action':
        return <ActionCell actions={dataRow.action} />;
      case 'type':
        return <TypeCell type={dataRow.type} />;
      case 'creator':
        return <UserCell user={dataRow.creator} />;
      case 'timeAgo':
        return <TimeAgoCell date={dataRow.timeAgo ?? undefined} />;
      case 'linkedItems':
        return <ConnectionCell ids={dataRow.linkedItems.ids} type={'detector'} />;
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

  story('TypeCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={typeTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));

  story('UserCell', () => (
    <Fragment>
      <GridEditable
        data={data}
        columnOrder={userTable}
        columnSortBy={[]}
        grid={{
          renderHeadCell,
          renderBodyCell,
        }}
      />
    </Fragment>
  ));
});
