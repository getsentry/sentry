import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {ScreensTable} from 'sentry/views/performance/mobile/components/screensTable';

function getMockEventView({fields}) {
  return new EventView({
    id: '1',
    name: 'mock query',
    fields,

    sorts: [],
    query: '',
    project: [],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: [],
    additionalConditions: new MutableSearch(''),
    createdBy: undefined,
    interval: undefined,
    display: '',
    team: [],
    topEvents: undefined,
    yAxis: undefined,
  });
}

describe('ScreensTable', () => {
  it('renders table header cells with translated names', () => {
    render(
      <ScreensTable
        columnNameMap={{
          transaction: 'Screen',
        }}
        columnOrder={['transaction']}
        data={{
          data: [{id: '1', transaction: 'Screen 1'}],
          meta: {},
        }}
        defaultSort={[]}
        eventView={getMockEventView({fields: [{field: 'transaction'}]})}
        isLoading={false}
        pageLinks={undefined}
      />
    );

    expect(screen.getByText('Screen')).toBeInTheDocument();
    expect(screen.queryByText('transaction')).not.toBeInTheDocument();
  });

  it('renders body cells with custom renderer if applicable', () => {
    render(
      <ScreensTable
        columnNameMap={{
          transaction: 'Screen',
        }}
        columnOrder={['transaction', 'non-custom']}
        data={{
          data: [
            {id: '1', transaction: 'Screen 1', 'non-custom': 'non customized value'},
          ],
          meta: {fields: {transaction: 'string'}},
        }}
        defaultSort={[]}
        eventView={getMockEventView({
          fields: [{field: 'transaction'}, {field: 'non-custom'}],
        })}
        isLoading={false}
        pageLinks={undefined}
        customBodyCellRenderer={(column, row) => {
          if (column.key === 'transaction') {
            return `Custom rendered ${row.transaction}`;
          }

          return null;
        }}
      />
    );

    expect(screen.getByText('Custom rendered Screen 1')).toBeInTheDocument();
    expect(screen.getByText('non customized value')).toBeInTheDocument();
  });
});
