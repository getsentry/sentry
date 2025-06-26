import {Fragment} from 'react';

import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable from 'sentry/components/gridEditable';
import {ActionCell} from 'sentry/components/workflowEngine/gridCell/actionCell';
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
import * as Storybook from 'sentry/stories';
import {ActionType} from 'sentry/types/workflowEngine/actions';

type ExampleAutomation = {
  actions: ActionType[];
  creator: string | null;
  linkedItems: ConnectionCellProps;
  openIssues: number;
  timeAgo: Date | null;
  title: TitleCellProps;
};

export default Storybook.story('Grid Cell Components', story => {
  const data: ExampleAutomation[] = [
    {
      title: {
        name: 'Slack suggested assignees',
        link: '/issues/monitors/1',
      },
      actions: [ActionType.SLACK],
      timeAgo: new Date(),
      linkedItems: {
        ids: ['abc123'],
        type: 'workflow',
      },
      openIssues: 3,
      creator: '1',
    },
    {
      title: {
        name: 'Send Discord notification',
        link: '/issues/monitors/2',
      },
      actions: [ActionType.DISCORD],
      timeAgo: new Date(Date.now() - 2 * 60 * 60 * 1000),
      linkedItems: {
        ids: ['abc123', 'def456', 'ghi789'],
        type: 'detector',
      },
      openIssues: 1,
      creator: '1',
    },
    {
      title: {
        name: 'Email suggested assignees',
        link: '/issues/monitors/3',
      },
      actions: [ActionType.EMAIL],
      timeAgo: new Date(Date.now() - 25 * 60 * 60 * 1000),
      linkedItems: {
        ids: ['abc123', 'def456'],
        type: 'workflow',
      },
      creator: 'sentry',
      openIssues: 0,
    },
    {
      title: {
        name: 'Send notification',
        link: '/issues/monitors/4',
        disabled: true,
      },
      actions: [ActionType.SLACK, ActionType.DISCORD, ActionType.EMAIL],
      creator: 'sentry',
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

  const actionTable: Array<GridColumnOrder<keyof ExampleAutomation>> = [
    {key: 'actions', name: 'Actions', width: 200},
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
            disabled={dataRow.title.disabled}
          />
        );
      case 'actions':
        return <ActionCell actions={dataRow.actions} />;
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
