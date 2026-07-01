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
import {DiscoverExportModalButton} from 'sentry/views/discover/table/discoverExportModalButton';
import {downloadAsCsv} from 'sentry/views/discover/utils';

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

function mockEstimatedRowCount(count: number) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-meta/`,
    body: {count},
  });
}

function renderButton({disabled}: {disabled?: boolean} = {}) {
  render(
    <DiscoverExportModalButton
      disabled={disabled}
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
    mockEstimatedRowCount(1);
    renderButton();

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Export Data'})).toBeEnabled()
    );
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

  it('disables the export button when disabled is true', async () => {
    mockEstimatedRowCount(1);
    renderButton({disabled: true});

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Export Data'})).toBeDisabled()
    );
  });

  it('downloads the loaded rows locally when the row-count estimate fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-meta/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 721},
    });

    renderButton();

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Export Data'})).toBeEnabled()
    );

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(downloadAsCsv).toHaveBeenCalledTimes(1);
    });
    expect(dataExportMock).not.toHaveBeenCalled();
  });

  it('disables the export button until the row-count estimate resolves', async () => {
    mockEstimatedRowCount(5000);
    renderButton();

    expect(screen.getByRole('button', {name: 'Export Data'})).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Export Data'})).toBeEnabled()
    );
  });

  it('estimates the row count from the events-meta endpoint', async () => {
    const countMock = mockEstimatedRowCount(5000);
    renderButton();

    await waitFor(() => {
      expect(countMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-meta/`,
        expect.anything()
      );
    });
  });

  it('routes to the server data-export endpoint when the estimate exceeds the loaded rows', async () => {
    const countMock = mockEstimatedRowCount(5000);
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 721},
    });

    renderButton();

    await waitFor(() => expect(countMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Export Data'})).toBeEnabled()
    );

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Number of rows'}));
    await userEvent.click(await screen.findByRole('option', {name: /\(All\)$/}));
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/data-export/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({query_type: 'Discover', limit: 5000}),
        })
      );
    });
    expect(downloadAsCsv).not.toHaveBeenCalled();
  });
});
