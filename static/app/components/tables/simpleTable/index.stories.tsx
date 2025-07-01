import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import type {Sort} from 'sentry/utils/discover/fields';

interface Data {
  action: string;
  lastTriggered: Date;
  monitors: number[];
  name: string;
}

const headers = [
  {
    key: 'name',
    label: 'Name',
  },
  {
    key: 'monitors',
    label: 'Monitors',
  },
  {
    key: 'action',
    label: 'Action',
  },
  {
    key: 'lastTriggered',
    label: 'Last Triggered',
  },
];

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

export default Storybook.story('SimpleTable', story => {
  story('Default', () => {
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
            <SimpleTable.HeaderCell>Name</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>Monitors</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>Action</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>Last Triggered</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          {data.map(row => (
            <SimpleTable.Row key={row.name}>
              <SimpleTable.RowCell>{row.name}</SimpleTable.RowCell>
              <SimpleTable.RowCell>
                {t('%s monitors', row.monitors.length)}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>{row.action}</SimpleTable.RowCell>
              <SimpleTable.RowCell>
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
            {headers.map(header => (
              <SimpleTable.HeaderCell key={header.key}>
                {header.label}
              </SimpleTable.HeaderCell>
            ))}
          </SimpleTable.Header>
          <SimpleTable.Empty>No data</SimpleTable.Empty>
        </SimpleTableWithColumns>
      </Fragment>
    );
  });

  story('Clickable rows', () => {
    return (
      <Fragment>
        <p>
          If you want to make a row clickable then you can wrap it in a{' '}
          <Storybook.JSXNode name="Link" /> or a raw <Storybook.JSXNode name="button" />,
          but be sure to set <code>display: contents; pointer: cursor;</code> in the css
        </p>
        <SimpleTableWithColumns>
          <SimpleTable.Header>
            {headers.map(header => (
              <SimpleTable.HeaderCell key={header.key}>
                {header.label}
              </SimpleTable.HeaderCell>
            ))}
          </SimpleTable.Header>
          <SimpleTable.Row>
            <Link
              to="#"
              onClick={e => {
                // eslint-disable-next-line no-console
                console.log('clicked a link');
                e.preventDefault();
              }}
              style={{display: 'contents', cursor: 'pointer'}}
            >
              <InteractionStateLayer />
              <SimpleTable.RowCell>
                Clickable <Storybook.JSXNode name="Link" />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>123</SimpleTable.RowCell>
              <SimpleTable.RowCell>123</SimpleTable.RowCell>
              <SimpleTable.RowCell>123</SimpleTable.RowCell>
            </Link>
          </SimpleTable.Row>
          <SimpleTable.Row>
            <button
              onClick={e => {
                // eslint-disable-next-line no-console
                console.log('clicked a button');
                e.preventDefault();
              }}
              style={{display: 'contents', cursor: 'pointer'}}
            >
              <InteractionStateLayer />
              <SimpleTable.RowCell>
                Clickable <Storybook.JSXNode name="button" />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>123</SimpleTable.RowCell>
              <SimpleTable.RowCell>123</SimpleTable.RowCell>
              <SimpleTable.RowCell>123</SimpleTable.RowCell>
            </button>
          </SimpleTable.Row>
        </SimpleTableWithColumns>
      </Fragment>
    );
  });

  story('Custom widths and hidden columns', () => {
    return (
      <Fragment>
        <p>
          Set custom widths for columns by styling SimpleTable with{' '}
          <code>grid-template-columns</code>.
        </p>
        <p>
          You can also hide columns by targeting the column in css, usually with a{' '}
          <Storybook.JSXProperty name="data-*" value="string" />
          attribute. This is useful for creating responsive tables.
        </p>
        <p>This table has 4 columns, but will hide some as it gets narrower.</p>
        <SizingWindowContainer>
          <SimpleTableWithHiddenColumns>
            <SimpleTable.Header>
              {headers.map(header => (
                <SimpleTable.HeaderCell key={header.key} data-column-name={header.key}>
                  {header.label}
                </SimpleTable.HeaderCell>
              ))}
            </SimpleTable.Header>
            {data.map(row => (
              <SimpleTable.Row key={row.name}>
                <SimpleTable.RowCell>{row.name}</SimpleTable.RowCell>
                <SimpleTable.RowCell>{row.monitors.length} monitors</SimpleTable.RowCell>
                <SimpleTable.RowCell data-column-name="action">
                  {row.action}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell data-column-name="lastTriggered">
                  <TimeAgoCell date={row.lastTriggered} />
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
          </SimpleTableWithHiddenColumns>
        </SizingWindowContainer>
      </Fragment>
    );
  });

  story('Sortable headers', () => {
    const [sort, setSort] = useState<Sort | undefined>(undefined);

    const handleSort = (field: string) => {
      if (sort) {
        setSort(
          sort.field === field
            ? {field, kind: sort.kind === 'asc' ? 'desc' : 'asc'}
            : {field, kind: 'asc'}
        );
      } else {
        setSort({field, kind: 'asc'});
      }
    };

    const sortField = sort?.field;
    const sortDirection = sort?.kind;

    return (
      <Fragment>
        <p>
          Header cells can be made sortable by providing{' '}
          <Storybook.JSXProperty name="sort" value="'asc' | 'desc'" /> and{' '}
          <Storybook.JSXProperty name="handleSortClick" value="() => void" /> props. The{' '}
          <code>sort</code> prop controls the visual indicator (arrow direction), while{' '}
          <code>handleSortClick</code> is called when the header is clicked.
        </p>

        <p>
          Click on the column headers below to sort the data. The current sort is:{' '}
          <strong>{sortField || 'none'}</strong>{' '}
          {sortField && <strong>({sortDirection})</strong>}
        </p>

        <SimpleTableWithColumns>
          <SimpleTable.Header>
            {headers.map(header => (
              <SimpleTable.HeaderCell
                key={header.key}
                sort={sortField === header.key ? sortDirection : undefined}
                handleSortClick={() => handleSort(header.key)}
              >
                {header.label}
              </SimpleTable.HeaderCell>
            ))}
          </SimpleTable.Header>
          {data.map(row => (
            <SimpleTable.Row key={row.name}>
              <SimpleTable.RowCell>{row.name}</SimpleTable.RowCell>
              <SimpleTable.RowCell>
                {t('%s monitors', row.monitors.length)}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>{row.action}</SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <TimeAgoCell date={row.lastTriggered} />
              </SimpleTable.RowCell>
            </SimpleTable.Row>
          ))}
        </SimpleTableWithColumns>
      </Fragment>
    );
  });
});

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 1fr 1fr 1fr;
`;

const SizingWindowContainer = styled(Storybook.SizingWindow)`
  container-type: inline-size;
`;

const SimpleTableWithHiddenColumns = styled(SimpleTable)`
  grid-template-columns: 2fr min-content auto 256px;

  @container (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 2fr min-content auto;

    [data-column-name='action'] {
      display: none;
    }
  }

  @container (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 2fr min-content;

    [data-column-name='lastTriggered'] {
      display: none;
    }
  }
`;
