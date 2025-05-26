import {Fragment} from 'react';
import moment from 'moment-timezone';

import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';

interface Data {
  action: string;
  lastTriggered: Date;
  monitors: number[];
  name: string;
}

const columns = defineColumns<Data>({
  name: {Header: () => t('Name')},
  monitors: {
    Header: () => t('Monitors'),
    Cell: ({value}) => `${value.length} monitors`,
  },
  action: {Header: () => t('Action')},
  lastTriggered: {
    Header: () => t('Last Triggered'),
    Cell: ({value}) => <TimeAgoCell date={value} />,
  },
});

export default Storybook.story('SimpleTable', story => {
  story('default', () => {
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
        <SimpleTable columns={columns} data={data} />
      </Fragment>
    );
  });

  story('empty', () => {
    const data: Data[] = [];

    return (
      <Fragment>
        <p>
          Use the <Storybook.JSXProperty name="fallback" value="message" /> property for
          empty states
        </p>

        <SimpleTable
          columns={columns}
          data={data}
          fallback={t('No alerts triggered during given date range')}
        />
      </Fragment>
    );
  });

  story('custom widths', () => {
    const columnsWithWidth = defineColumns<Data>({
      name: {Header: () => t('Name'), width: '2fr'},
      monitors: {
        Header: () => t('Monitors'),
        Cell: ({value}) => `${value.length} monitors`,
        width: 'min-content',
      },
      action: {Header: () => t('Action')},
      lastTriggered: {
        Header: () => t('Last Triggered'),
        Cell: ({value}) => <TimeAgoCell date={value} />,
        width: '256px',
      },
    });
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
        <SimpleTable columns={columnsWithWidth} data={data} />
      </Fragment>
    );
  });
});
