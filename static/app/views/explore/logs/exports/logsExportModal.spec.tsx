import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsExportModal} from 'sentry/views/explore/logs/exports/logsExportModal';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const mockAddSuccessMessage = jest.fn();

jest.mock('sentry/actionCreators/indicator', () => ({
  get addSuccessMessage() {
    return mockAddSuccessMessage;
  },
}));

const mockDownloadLogs = jest.fn();

jest.mock('sentry/views/explore/logs/exports/downloadLogs', () => ({
  get downloadLogs() {
    return mockDownloadLogs;
  },
}));

const organization = OrganizationFixture({features: ['discover-query']});
const closeModal = jest.fn();

const queryInfo: LogsQueryInfo = {
  dataset: 'logs',
  field: [OurLogKnownFieldKey.MESSAGE],
  project: [1],
  query: 'level:error',
  sort: ['-timestamp'],
};

const tableData = Array.from({length: 1500}).map((_, i) =>
  LogFixture({
    id: `log-${i}`,
    [OurLogKnownFieldKey.PROJECT_ID]: `${i}`,
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
  })
);

function mockTimeseriesCount(sampleCount = 0) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-timeseries/`,
    method: 'GET',
    body: {
      timeSeries: [
        {
          yAxis: 'count(message)',
          values: [
            {
              value: 1,
              timestamp: 1729796400000,
              sampleCount,
              sampleRate: 1,
            },
          ],
          meta: {
            dataScanned: 'full',
            interval: 3_600_000,
            valueType: 'number',
          },
        },
      ],
    },
  });
}

function renderModal() {
  return render(
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      <LogsExportModal
        Body={ModalBody}
        Footer={ModalFooter}
        Header={makeClosableHeader(closeModal)}
        CloseButton={makeCloseButton(closeModal)}
        closeModal={closeModal}
        queryInfo={queryInfo}
        tableData={tableData}
      />
    </LogsQueryParamsProvider>,
    {organization}
  );
}

describe('LogsExportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('calls closeModal when Cancel is clicked', async () => {
    mockTimeseriesCount();
    renderModal();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(closeModal).toHaveBeenCalled();
  });

  it('downloads in the browser and shows a success toast when Export is clicked without any options', async () => {
    mockTimeseriesCount();
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    renderModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(mockDownloadLogs).toHaveBeenCalledTimes(1);
    });

    expect(mockDownloadLogs).toHaveBeenCalledWith({
      rows: tableData.slice(0, 100),
      fields: queryInfo.field,
      filename: 'logs',
      format: 'csv',
    });
    expect(dataExportMock).not.toHaveBeenCalled();
    expect(addSuccessMessage).toHaveBeenCalledWith('Downloading file to your browser.');
  });

  it('POSTs to data-export when row limit is above the sync limit', async () => {
    const aboveSyncLimit = tableData.length;
    mockTimeseriesCount();
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 721},
    });

    renderModal();

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {
        name: /\(All\)$/,
      })
    );
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalled();
    });

    expect(dataExportMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/data-export/`,
      expect.objectContaining({
        data: {
          format: 'csv',
          query_type: 'trace_item_full_export',
          query_info: {
            ...queryInfo,
            dataset: 'logs',
            limit: aboveSyncLimit,
          },
        },
        method: 'POST',
        error: expect.anything(),
        success: expect.anything(),
      })
    );
    expect(mockDownloadLogs).not.toHaveBeenCalled();
    expect(mockAddSuccessMessage).toHaveBeenCalledWith(
      "Sit tight. We'll shoot you an email when your data is ready for download."
    );
  });
});
