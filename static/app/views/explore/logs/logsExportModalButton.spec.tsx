import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {LogsExportModalButton} from 'sentry/views/explore/logs/exports/logsExportModalButton';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const mockTrackAnalytics = jest.fn();

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: (...args: unknown[]) => mockTrackAnalytics(...args),
}));

describe('LogsExportModalButton', () => {
  const organization = OrganizationFixture({features: ['discover-query']});

  const queryInfo: LogsQueryInfo = {
    dataset: 'logs',
    field: [OurLogKnownFieldKey.MESSAGE],
    project: [1],
    query: 'level:error',
    sort: ['-timestamp'],
  };

  const tableData = [
    LogFixture({
      id: 'log-1',
      [OurLogKnownFieldKey.PROJECT_ID]: '1',
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
    }),
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    // The export modal estimates row counts from a timeseries query.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {timeSeries: []},
    });
  });

  async function renderAndOpen() {
    render(
      <LogsExportModalButton
        error={null}
        isLoading={false}
        queryInfo={queryInfo}
        tableData={tableData}
      />,
      {organization}
    );
    renderGlobalModal();
    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  }

  it('opens the export modal and tracks open analytics', async () => {
    await renderAndOpen();

    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'logs.export_modal',
      expect.objectContaining({action: 'open'})
    );
  });

  it('tracks cancel analytics with escape_key when closed via Escape', async () => {
    await renderAndOpen();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(mockTrackAnalytics).toHaveBeenCalledWith(
        'logs.export_modal',
        expect.objectContaining({action: 'cancel', close_reason: 'escape_key'})
      );
    });
  });

  it('does not double-fire cancel analytics when closed via the Cancel button', async () => {
    await renderAndOpen();

    await userEvent.click(await screen.findByRole('button', {name: 'Cancel'}));

    // The Cancel button itself fires cancel/cancel_button. The onClose
    // callback receives no reason in the programmatic-close path and must
    // skip its own cancel event so we don't get a duplicate.
    await waitFor(() => {
      expect(mockTrackAnalytics).toHaveBeenCalledWith(
        'logs.export_modal',
        expect.objectContaining({action: 'cancel', close_reason: 'cancel_button'})
      );
    });
    const cancelCalls = mockTrackAnalytics.mock.calls.filter(
      ([event, payload]) => event === 'logs.export_modal' && payload?.action === 'cancel'
    );
    expect(cancelCalls).toHaveLength(1);
  });
});
