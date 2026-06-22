import type {ReactNode} from 'react';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {EventView} from 'sentry/utils/discover/eventView';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {TracesExportModalButton} from 'sentry/views/explore/spans/tracesExportModalButton';

jest.mock('sentry/views/discover/utils', () => ({
  ...jest.requireActual('sentry/views/discover/utils'),
  downloadAsCsv: jest.fn(),
}));

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

function makeQueryResult(
  data: Array<Record<string, unknown>>
): SpansTableResult['result'] {
  return {data, isPending: false, error: null} as unknown as SpansTableResult['result'];
}

describe('TracesExportModalButton', () => {
  const {organization} = initializeOrg({
    organization: {features: ['discover-query']},
  });

  const eventView = EventView.fromNewQueryWithLocation(
    {name: 'Traces', fields: ['span.description'], version: 2, query: ''},
    LocationFixture()
  );

  const aggregatesTableResult: AggregatesTableResult = {
    eventView,
    fields: [],
    result: makeQueryResult([]),
  };

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  function renderButton({
    spanRows = [{id: '1', 'span.description': 'GET /'}],
    totalCount = 5000,
  }: {spanRows?: Array<Record<string, unknown>>; totalCount?: number} = {}) {
    const spansTableResult: SpansTableResult = {
      eventView,
      result: makeQueryResult(spanRows),
    };
    const rawSpanCounts: RawCounts = {
      normal: {count: totalCount, isLoading: false},
      total: {count: totalCount, isLoading: false},
    };
    render(
      <TracesExportModalButton
        aggregatesTableResult={aggregatesTableResult}
        spansTableResult={spansTableResult}
        rawSpanCounts={rawSpanCounts}
      />,
      {organization, additionalWrapper: Wrapper}
    );
    renderGlobalModal();
  }

  it('does not render the All Columns switch when the modal is opened', async () => {
    renderButton();

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Traces Export'})).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'All Columns?'})
    ).not.toBeInTheDocument();
  });

  it('downloads CSV in the browser when the requested rows are already loaded', async () => {
    renderButton({
      spanRows: [
        {id: '1', 'span.description': 'GET /'},
        {id: '2', 'span.description': 'GET /a'},
      ],
      totalCount: 2,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(downloadAsCsv).toHaveBeenCalledTimes(1);
    });
  });

  it('POSTs an Explore export with the spans dataset when the row count exceeds the sync limit', async () => {
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 7},
    });

    renderButton();

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Number of rows'}));
    await userEvent.click(await screen.findByRole('option', {name: /\(All\)$/}));
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalled();
    });

    expect(dataExportMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/data-export/`,
      expect.objectContaining({
        data: expect.objectContaining({
          query_type: 'Explore',
          query_info: expect.objectContaining({dataset: 'spans'}),
        }),
      })
    );
    expect(downloadAsCsv).not.toHaveBeenCalled();
  });
});
