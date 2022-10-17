import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TableDataRow} from 'sentry/utils/discover/discoverQuery';

import QuickContext from './quickContext';
import {TableColumn} from './types';

const defaultRow: TableDataRow = {
  id: '6b43e285de834ec5b5fe30d62d549b20',
  issue: 'SENTRY-VVY',
  release: 'backend@22.10.0+aaf33944f93dc8fa4234ca046a8d88fb1dccfb76',
  title: 'error: Error -3 while decompressing data: invalid stored block lengths',
  'issue.id': 3512441874,
  'project.name': 'sentry',
};

const defaultColumn: TableColumn<keyof TableDataRow> = {
  column: {
    alias: undefined,
    field: 'issue',
    kind: 'field',
  },
  isSortable: false,
  key: 'issue',
  name: 'issue',
  type: 'string',
  width: -1,
};

const renderComponent = (
  dataRow: TableDataRow = defaultRow,
  column: TableColumn<keyof TableDataRow> = defaultColumn
) => {
  render(<QuickContext dataRow={dataRow} column={column} />);
};

// TO-DO: Expand test suite to cover error state.
describe('Quick Context Container', function () {
  it('Loading indicator is rendered before data loads', () => {
    renderComponent(defaultRow, defaultColumn);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('Render issue context when data is loaded', async () => {
    renderComponent(defaultRow, defaultColumn);

    expect(await screen.findByText(/Displaying Context for issue./i)).toBeInTheDocument();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });
});
