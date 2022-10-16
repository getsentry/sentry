import {render, screen} from 'sentry-test/reactTestingLibrary';

import {t} from 'sentry/locale';
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
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('Quick Context default behaviour', function () {
    it('Loading/Error states render for Quick Context.', async () => {
      MockApiClient.addMockResponse({
        url: '/issues/3512441874/',
        statusCode: 500,
      });
      renderComponent(defaultRow, defaultColumn);

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(
        await screen.findByText(t('Failed to load context for column.'))
      ).toBeInTheDocument();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  describe('Quick Context for Issue Column', function () {
    describe('Quick Context for Issue Column - Status', function () {
      it('Render Ignored Issue status context when data is loaded', async () => {
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: {
            status: 'ignored',
          },
        });
        renderComponent(defaultRow, defaultColumn);

        expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Ignored/i)).toBeInTheDocument();
        expect(screen.getByTestId('quick-context-mute-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });

      it('Render Resolved Issue status context when data is loaded', async () => {
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: {
            status: 'resolved',
          },
        });
        renderComponent(defaultRow, defaultColumn);

        expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
        expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });

      it('Render Unresolved Issue status context when data is loaded', async () => {
        MockApiClient.addMockResponse({
          url: '/issues/3512441874/',
          body: {
            status: 'unresolved',
          },
        });
        renderComponent(defaultRow, defaultColumn);

        expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Unresolved/i)).toBeInTheDocument();
        expect(screen.getByTestId('quick-context-not-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });
    });
  });
});
