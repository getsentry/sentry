import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {EventView} from 'sentry/utils/discover/eventView';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import {DiscoverExportModalButton} from 'sentry/views/discover/table/discoverExportModalButton';

const mockTrackAnalytics = jest.fn();

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: (...args: unknown[]) => mockTrackAnalytics(...args),
}));

jest.mock('sentry/views/discover/utils', () => ({
  ...jest.requireActual('sentry/views/discover/utils'),
  downloadAsCsv: jest.fn(),
}));

const organization = OrganizationFixture({features: ['discover-query']});

const eventView = EventView.fromNewQueryWithLocation(
  {name: 'Test', fields: ['id'], version: 2, query: ''},
  LocationFixture()
);

const tableData: TableData = {data: [{id: '1'}]};

function renderButton() {
  render(
    <DiscoverExportModalButton
      error={null}
      eventView={eventView}
      isLoading={false}
      location={LocationFixture()}
      organization={organization}
      tableData={tableData}
      title="my query"
    />,
    {organization}
  );
  renderGlobalModal();
}

describe('DiscoverExportModalButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('downloads CSV and tracks analytics when the export is submitted', async () => {
    renderButton();

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(downloadAsCsv).toHaveBeenCalledTimes(1);
    });
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'discover_v2.results.download_csv',
      expect.objectContaining({organization: organization.id})
    );
  });
});
