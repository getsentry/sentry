import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';

interface Data {
  action: string;
  lastTriggered: Date;
  monitors: number[];
  name: string;
}

export default Storybook.story('SimpleTable', story => {
  story('Default', () => {
    const data: Data[] = [
      {
        name: 'Row A',
        monitors: [1],
        action: 'Email',
        lastTriggered: moment().subtract(1, 'day').toDate(),
      },
      {
        name: 'Row B',
        monitors: [3, 5, 7],
        action: 'Slack',
        lastTriggered: moment().subtract(2, 'days').toDate(),
      },
      {
        name: 'Row C',
        monitors: [2, 4, 6, 8],
        action: 'PagerDuty',
        lastTriggered: moment().subtract(3, 'days').toDate(),
      },
    ];

    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="SimpleTable" /> component is a simplified variant
          of the
          <Storybook.JSXNode name="GridEditable" /> component. It does not support
          adjustable column widths and provides a simplified API surface.
        </p>

        <p>
          The <Storybook.JSXNode name="SimpleTable" /> component accepts two
          properties&mdash;table configuration is handled by{' '}
          <Storybook.JSXProperty name="columns" value="{}" />. The rows are dictated by{' '}
          <Storybook.JSXProperty name="data" value="Record<string, unknown>[]" />. The{' '}
          <code>columns</code> property is an object where the keys match the{' '}
          <code>Data</code> keys and the values are objects with{' '}
          <Storybook.JSXProperty name="Header" value="() => React.ReactNode" /> and{' '}
          <Storybook.JSXProperty
            name="Cell"
            value="(props: { value: Cell }) => React.ReactNode"
          />{' '}
          <Storybook.JSXProperty name="width" value="string" /> components.
        </p>
        <p>
          Use the <code>defineColumns()</code> helper function for improved type-safety.
          To optimize performance, define your columns outside of the component where they
          will be rendered (otherwise the columns will be redefined on every render).
        </p>

        <p>
          An example <Storybook.JSXNode name="SimpleTable" /> looks like this:
        </p>
        <SimpleTableWithColumns>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell name="name" sortKey="name">
              Name
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell name="monitors" sortKey="monitors">
              Monitors
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell name="action" sortKey="action">
              Action
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell name="lastTriggered" sortKey="lastTriggered">
              Last Triggered
            </SimpleTable.HeaderCell>
          </SimpleTable.Header>
          {data.map(row => (
            <SimpleTable.Row key={row.name}>
              <SimpleTable.RowCell name="name">{row.name}</SimpleTable.RowCell>
              <SimpleTable.RowCell name="monitors">
                {t('%s monitors', row.monitors.length)}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell name="action">{row.action}</SimpleTable.RowCell>
              <SimpleTable.RowCell name="lastTriggered">
                <TimeAgoCell date={row.lastTriggered} />
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
        </SimpleTableWithColumns>
      </Fragment>
    );
  });

  story('Empty states', () => {
    return (
      <Fragment>
        <p>
          Use the <Storybook.JSXNode name="SimpleTable.Empty" /> component for empty
          states
        </p>

        <SimpleTableWithColumns>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell name="name" sortKey="name">
              Name
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell name="monitors" sortKey="monitors">
              Monitors
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell name="action" sortKey="action">
              Action
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell name="lastTriggered" sortKey="lastTriggered">
              Last Triggered
            </SimpleTable.HeaderCell>
          </SimpleTable.Header>
          <SimpleTable.Empty>No data</SimpleTable.Empty>
        </SimpleTableWithColumns>
      </Fragment>
    );
  });

  story('Custom widths and hidden columns', () => {
    const data: Data[] = [
      {
        name: 'Row A',
        monitors: [1],
        action: 'Email',
        lastTriggered: moment().subtract(1, 'day').toDate(),
      },
      {
        name: 'Row B',
        monitors: [3, 5, 7],
        action: 'Slack',
        lastTriggered: moment().subtract(2, 'days').toDate(),
      },
      {
        name: 'Row C',
        monitors: [2, 4, 6, 8],
        action: 'PagerDuty',
        lastTriggered: moment().subtract(3, 'days').toDate(),
      },
    ];

    const tableContent = (
      <Fragment>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell name="name" sortKey="name">
            Name
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell name="monitors" sortKey="monitors">
            Monitors
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell name="action" sortKey="action">
            Action
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell name="lastTriggered" sortKey="lastTriggered">
            Last Triggered
          </SimpleTable.HeaderCell>
        </SimpleTable.Header>
        {data.map(row => (
          <SimpleTable.Row key={row.name}>
            <SimpleTable.RowCell name="name">{row.name}</SimpleTable.RowCell>
            <SimpleTable.RowCell name="monitors">
              {row.monitors.length} monitors
            </SimpleTable.RowCell>
            <SimpleTable.RowCell name="action">{row.action}</SimpleTable.RowCell>
            <SimpleTable.RowCell name="lastTriggered">
              <TimeAgoCell date={row.lastTriggered} />
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </Fragment>
    );

    return (
      <Fragment>
        <p>
          Set custom widths for columns by styling SimpleTable with{' '}
          <code>grid-template-columns</code>.
        </p>

        <SimpleTableWithCustomWidths>{tableContent}</SimpleTableWithCustomWidths>
        <p>
          You can also hide columns by targeting the column's class name, which is useful
          for creating responsive tables.
        </p>
        <SimpleTableWithHiddenColumns>{tableContent}</SimpleTableWithHiddenColumns>
      </Fragment>
    );
  });
});

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 1fr 1fr 1fr;
`;

const SimpleTableWithCustomWidths = styled(SimpleTable)`
  grid-template-columns: 2fr min-content auto 256px;
`;

const SimpleTableWithHiddenColumns = styled(SimpleTableWithCustomWidths)`
  grid-template-columns: 2fr min-content auto;

  .lastTriggered {
    display: none;
  }
`;
