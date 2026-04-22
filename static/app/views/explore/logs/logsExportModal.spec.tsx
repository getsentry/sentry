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
import {TraceItemDataset} from 'sentry/views/explore/types';

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

const mockUseDataExport = jest.fn();

jest.mock('sentry/components/exports/useDataExport', () => ({
  ...jest.requireActual('sentry/components/exports/useDataExport'),
  get useDataExport() {
    return mockUseDataExport;
  },
}));

const mockTrackAnalytics = jest.fn();

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: (...args: unknown[]) => mockTrackAnalytics(...args),
}));

const organization = OrganizationFixture({features: ['discover-query']});
const closeModal = jest.fn();
const mockHandleDataExport = jest.fn();

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
  mockUseDataExport.mockReturnValue(mockHandleDataExport);

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
  });

  it('calls closeModal when Cancel is clicked', async () => {
    renderModal(500);

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'logs.export_modal',
      expect.objectContaining({
        action: 'cancel',
        close_reason: 'cancel_button',
      })
    );
    expect(closeModal).toHaveBeenCalled();
  });

  it('downloads CSV in the browser and shows a success toast when a CSV Export is clicked without any options', async () => {
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
    expect(mockHandleDataExport).not.toHaveBeenCalled();
    expect(addSuccessMessage).toHaveBeenCalledWith('Downloading file to your browser.');
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'explore.table_exported',
      expect.objectContaining({
        export_type: 'browser_sync',
        export_row_limit: 100,
        export_file_format: 'csv',
        query: queryInfo.query,
        traceItemDataset: TraceItemDataset.LOGS,
      })
    );
  });

  it('downloads JSONL in the browser and shows a success toast when a JSONL Export is clicked without any options', async () => {
    renderModal(500);

    await userEvent.click(screen.getByRole('radio', {name: 'JSONL'}));
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(mockDownloadLogs).toHaveBeenCalledTimes(1);
    });

    expect(mockDownloadLogs).toHaveBeenCalledWith({
      rows: tableData.slice(0, 100),
      fields: queryInfo.field,
      filename: 'logs',
      format: 'jsonl',
    });
    expect(mockHandleDataExport).not.toHaveBeenCalled();
    expect(addSuccessMessage).toHaveBeenCalledWith('Downloading file to your browser.');
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'explore.table_exported',
      expect.objectContaining({
        export_type: 'browser_sync',
        export_row_limit: 100,
        export_file_format: 'jsonl',
        query: queryInfo.query,
        traceItemDataset: TraceItemDataset.LOGS,
      })
    );
  });

  it('calls handleDataExport when row limit is above the sync limit', async () => {
    const aboveSyncLimit = QUERY_PAGE_LIMIT + 1;
    renderModal(aboveSyncLimit);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(
      screen.getByRole('menuitemradio', {
        name: new RegExp(`^${aboveSyncLimit.toLocaleString()} \\(All\\)$`),
      })
    );
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(mockHandleDataExport).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'csv',
          queryInfo: expect.objectContaining({
            limit: aboveSyncLimit,
          }),
        })
      );
    });

    expect(mockDownloadLogs).not.toHaveBeenCalled();
    expect(mockAddSuccessMessage).not.toHaveBeenCalled();
    expect(mockTrackAnalytics).toHaveBeenCalledWith(
      'explore.table_exported',
      expect.objectContaining({
        export_type: 'export_download',
        export_row_limit: aboveSyncLimit,
        export_file_format: 'csv',
        traceItemDataset: TraceItemDataset.LOGS,
      })
    );
  });
});
