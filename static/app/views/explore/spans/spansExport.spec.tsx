import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {downloadAsCsv} from 'sentry/views/discover/utils';
import {SpansExport} from 'sentry/views/explore/spans/spansExport';

jest.mock('sentry/views/discover/utils', () => ({
  downloadAsCsv: jest.fn(),
}));

describe('SpansExport', () => {
  const {organization} = initializeOrg({
    organization: {features: ['discover-query']},
  });

  const aggregatesTableResult = {
    result: {
      data: [],
      isPending: false,
      error: null,
    },
    eventView: {
      getColumns: () => [],
      getEventsAPIPayload: () => ({}),
    },
    fields: ['browser.name', 'count()'],
  } as any;

  const spansTableResult = {
    result: {
      data: [],
      isPending: false,
      error: null,
    },
    eventView: {
      getColumns: () => [],
      getEventsAPIPayload: () => ({}),
    },
  } as any;

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('should render the export button', () => {
    render(
      <SpansExport
        aggregatesTableResult={aggregatesTableResult}
        spansTableResult={spansTableResult}
      />,
      {organization}
    );
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('should render export button with small size data', async () => {
    aggregatesTableResult.result.data = [{'browser.name': 'Chrome', count: 1}];
    spansTableResult.result.data = [{id: '1', 'browser.name': 'Chrome'}];
    render(
      <SpansExport
        aggregatesTableResult={aggregatesTableResult}
        spansTableResult={spansTableResult}
      />,
      {organization}
    );

    const exportButton = screen.getByText('Export');
    expect(exportButton).toBeInTheDocument();

    await userEvent.hover(exportButton);
    expect(
      await screen.findByText(
        "There aren't that many results, start your export and it'll download immediately."
      )
    ).toBeInTheDocument();
  });

  it('should render export button with large size data', async () => {
    aggregatesTableResult.result.data = new Array(100).fill({
      'browser.name': 'Chrome',
      count: 1,
    });
    spansTableResult.result.data = new Array(100).fill({
      id: '1',
      'browser.name': 'Chrome',
    });

    render(
      <SpansExport
        aggregatesTableResult={aggregatesTableResult}
        spansTableResult={spansTableResult}
      />,
      {
        organization,
      }
    );

    const exportButton = screen.getByText('Export');
    expect(exportButton).toBeInTheDocument();

    await userEvent.hover(exportButton);
    expect(
      await screen.findByText(
        "Put your data to work. Start your export and we'll email you when it's finished."
      )
    ).toBeInTheDocument();
  });

  it('should download data when export button is clicked', async () => {
    aggregatesTableResult.result.data = [{'browser.name': 'Chrome', count: 1}];
    spansTableResult.result.data = [{id: '1', 'browser.name': 'Chrome'}];
    render(
      <SpansExport
        aggregatesTableResult={aggregatesTableResult}
        spansTableResult={spansTableResult}
      />,
      {organization}
    );

    const exportButton = screen.getByText('Export');
    await userEvent.click(exportButton);

    expect(downloadAsCsv).toHaveBeenCalled();
  });

  it('should use data-export endpoint for large data volume', async () => {
    aggregatesTableResult.result.data = new Array(100).fill({
      'browser.name': 'Chrome',
      count: 1,
    });
    spansTableResult.result.data = new Array(100).fill({
      id: '1',
      'browser.name': 'Chrome',
    });

    const dataExportEndpointMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      body: [],
      method: 'POST',
      statusCode: 201,
    });

    render(
      <SpansExport
        aggregatesTableResult={aggregatesTableResult}
        spansTableResult={spansTableResult}
      />,
      {organization}
    );

    const exportButton = screen.getByText('Export');
    await userEvent.click(exportButton);

    expect(downloadAsCsv).not.toHaveBeenCalled();
    expect(dataExportEndpointMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("We're working on it...")).toBeInTheDocument();
  });
});
