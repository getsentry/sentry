import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeCloseButton,
  makeClosableHeader,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import {ExploreExportModal} from 'sentry/views/explore/components/exports/exploreExportModal';
import type {TraceItemExportConfig} from 'sentry/views/explore/components/exports/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

const mockAddSuccessMessage = jest.fn();

jest.mock('sentry/actionCreators/indicator', () => ({
  get addSuccessMessage() {
    return mockAddSuccessMessage;
  },
}));

const organization = OrganizationFixture({features: ['discover-query']});
const closeModal = jest.fn();

const queryInfo = {
  dataset: TraceItemDataset.LOGS,
  field: ['message'],
  project: [1],
  query: 'level:error',
  sort: ['-timestamp'],
};

function makeConfig(
  overrides: Partial<TraceItemExportConfig> = {}
): TraceItemExportConfig {
  return {
    title: 'Test Export',
    filenameBase: 'test',
    queryInfo,
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns: true,
    availableFormats: ['csv', 'jsonl'],
    estimatedRowCount: 1500,
    localRowCount: 1000,
    localDownload: jest.fn(),
    trackExportSubmit: jest.fn(),
    ...overrides,
  };
}

function renderModal(config: TraceItemExportConfig, onCancel = jest.fn()) {
  render(
    <ExploreExportModal
      Body={ModalBody}
      Footer={ModalFooter}
      Header={makeClosableHeader(closeModal)}
      CloseButton={makeCloseButton(closeModal)}
      closeModal={closeModal}
      config={config}
      onCancel={onCancel}
    />,
    {organization}
  );
}

describe('ExploreExportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('calls onCancel and closeModal when Cancel is clicked', async () => {
    const onCancel = jest.fn();
    renderModal(makeConfig(), onCancel);

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(onCancel).toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  });

  it('downloads in the browser when Export is clicked without any options', async () => {
    const config = makeConfig();
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {id: 721},
    });

    renderModal(config);

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(config.localDownload).toHaveBeenCalledTimes(1);
    });

    expect(config.localDownload).toHaveBeenCalledWith({format: 'csv', limit: 500});
    expect(config.trackExportSubmit).toHaveBeenCalledWith({
      format: 'csv',
      limit: 500,
      isAllColumns: false,
      exportType: 'browser_sync',
    });
    expect(dataExportMock).not.toHaveBeenCalled();
    expect(mockAddSuccessMessage).toHaveBeenCalledWith(
      'Downloading file to your browser.'
    );
  });

  it("disables the Format radios and selects JSONL when the 'All Columns' switch is on", async () => {
    renderModal(makeConfig());

    await userEvent.click(await screen.findByRole('checkbox', {name: 'All Columns?'}));

    expect(screen.getByRole('radio', {name: 'CSV'})).toBeDisabled();
    expect(screen.getByRole('radio', {name: 'JSONL'})).toBeDisabled();
    expect(screen.getByRole('radio', {name: 'JSONL'})).toBeChecked();
  });

  it("POSTs trace_item_full_export with jsonl when the 'All Columns' switch is on", async () => {
    const config = makeConfig();
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 721},
    });

    renderModal(config);

    await userEvent.click(await screen.findByRole('checkbox', {name: 'All Columns?'}));
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalled();
    });

    expect(dataExportMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/data-export/`,
      expect.objectContaining({
        data: {
          format: 'jsonl',
          limit: 500,
          query_type: 'trace_item_full_export',
          query_info: {...queryInfo, field: []},
        },
        method: 'POST',
        error: expect.anything(),
        success: expect.anything(),
      })
    );
    expect(config.localDownload).not.toHaveBeenCalled();
  });

  it('POSTs to data-export when the row limit is above the sync limit', async () => {
    const config = makeConfig();
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 721},
    });

    renderModal(config);

    await userEvent.click(screen.getByRole('button', {name: 'Number of rows'}));
    await userEvent.click(await screen.findByRole('option', {name: /\(All\)$/}));
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalled();
    });

    expect(dataExportMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/data-export/`,
      expect.objectContaining({
        data: {
          format: 'csv',
          limit: 1500,
          query_type: 'Explore',
          query_info: queryInfo,
        },
        method: 'POST',
        error: expect.anything(),
        success: expect.anything(),
      })
    );
    expect(config.localDownload).not.toHaveBeenCalled();
    expect(mockAddSuccessMessage).toHaveBeenCalledWith(
      "Sit tight. We'll shoot you an email when your data is ready for download."
    );
  });

  it('routes to the server export when the limit exceeds the locally loaded rows', async () => {
    const config = makeConfig({
      supportsAllColumns: false,
      availableFormats: ['csv'],
      estimatedRowCount: 133,
      localRowCount: 50,
    });
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 721},
    });

    renderModal(config);

    await userEvent.click(screen.getByRole('button', {name: 'Number of rows'}));
    await userEvent.click(await screen.findByRole('option', {name: /\(All\)$/}));
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/data-export/`,
        expect.objectContaining({
          data: expect.objectContaining({limit: 133, query_type: 'Explore'}),
        })
      );
    });
    expect(config.localDownload).not.toHaveBeenCalled();
  });

  it('hides the All Columns switch when not supported', async () => {
    renderModal(makeConfig({supportsAllColumns: false}));

    expect(await screen.findByRole('button', {name: 'Export'})).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'All Columns?'})
    ).not.toBeInTheDocument();
  });

  it('hides the Format radios when only one format is available', async () => {
    renderModal(makeConfig({supportsAllColumns: false, availableFormats: ['csv']}));

    expect(await screen.findByRole('button', {name: 'Export'})).toBeInTheDocument();
    expect(screen.queryByRole('radio', {name: 'CSV'})).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', {name: 'JSONL'})).not.toBeInTheDocument();
  });
});
