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
import {QUERY_PAGE_LIMIT} from 'sentry/views/explore/logs/constants';
import {LogsExportModal} from 'sentry/views/explore/logs/logsExportModal';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const mockAddSuccessMessage = jest.fn();

jest.mock('sentry/actionCreators/indicator', () => ({
  get addSuccessMessage() {
    return mockAddSuccessMessage;
  },
}));

const mockDownloadLogs = jest.fn();

jest.mock('sentry/views/explore/logs/downloadLogs', () => ({
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

const tableData = Array.from({length: 500}).map((_, i) =>
  LogFixture({
    id: `log-${i}`,
    [OurLogKnownFieldKey.PROJECT_ID]: `${i}`,
    [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
  })
);

function renderModal(estimatedRowCount: number) {
  return render(
    <LogsExportModal
      Body={ModalBody}
      Footer={ModalFooter}
      Header={makeClosableHeader(closeModal)}
      CloseButton={makeCloseButton(closeModal)}
      closeModal={closeModal}
      estimatedRowCount={estimatedRowCount}
      queryInfo={queryInfo}
      tableData={tableData}
    />,
    {organization}
  );
}

describe('LogsExportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('calls closeModal when Cancel is clicked', async () => {
    renderModal(500);

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(closeModal).toHaveBeenCalled();
  });

  it('downloads in the browser and shows a success toast when Export is clicked without any options', async () => {
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    renderModal(500);

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
    const aboveSyncLimit = QUERY_PAGE_LIMIT + 1;
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 721},
    });

    renderModal(aboveSyncLimit);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(
      screen.getByRole('menuitemradio', {
        name: new RegExp(`^${aboveSyncLimit.toLocaleString()} \\(All\\)$`),
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
          query_type: 'Explore',
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
