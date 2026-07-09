import type {ReactNode} from 'react';
import {QueryObserver} from '@tanstack/react-query';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {ResponseMeta} from 'sentry/types/api';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {EventView} from 'sentry/utils/discover/eventView';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {downloadAsCsv} from 'sentry/views/discover/utils';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {TracesExportModalButton} from 'sentry/views/explore/spans/tracesExportModalButton';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';

jest.mock('sentry/views/discover/utils', () => ({
  ...jest.requireActual('sentry/views/discover/utils'),
  downloadAsCsv: jest.fn(),
}));

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

function makeQueryResult(
  data: Array<Record<string, unknown>>,
  {error = null, pageLinks}: {error?: QueryError | null; pageLinks?: string} = {}
): SpansTableResult['result'] {
  const queryClient = makeTestQueryClient();
  const queryKey = ['traces-export-modal-test'];

  if (error) {
    queryClient
      .getQueryCache()
      .build(queryClient, {queryKey})
      .setState({status: 'error', error, fetchStatus: 'idle'});
  } else {
    queryClient.setQueryData(queryKey, [{data: []}, undefined, undefined]);
  }

  const base = new QueryObserver<
    [TableData, string | undefined, ResponseMeta<TableData> | undefined],
    QueryError
  >(queryClient, {queryKey, enabled: false}).getCurrentResult();

  return {
    ...base,
    data: error ? undefined : data,
    error,
    statusCode: undefined,
    response: undefined,
    meta: undefined,
    pageLinks,
  };
}

const HAS_MORE_ROWS_LINK = '<https://sentry.io/fake/next>; rel="next"; results="true"';

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
  }: {spanRows?: Array<Record<string, unknown>>; totalCount?: number | null} = {}) {
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

  it('disables export when viewing the Trace tab even though aggregate rows are loaded', () => {
    const aggregatesWithRows: AggregatesTableResult = {
      ...aggregatesTableResult,
      result: makeQueryResult([{id: 'a', 'span.description': 'GET /agg'}]),
    };

    render(
      <TracesExportModalButton
        aggregatesTableResult={aggregatesWithRows}
        spansTableResult={{eventView, result: makeQueryResult([])}}
        rawSpanCounts={{
          normal: {count: 0, isLoading: false},
          total: {count: 0, isLoading: false},
        }}
      />,
      {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {location: {pathname: '/', query: {table: 'trace'}}},
      }
    );

    expect(screen.getByRole('button', {name: 'Export Data'})).toBeDisabled();
  });

  it('does not surface the aggregates table state in the tooltip on a non-exportable tab', async () => {
    const erroringAggregates: AggregatesTableResult = {
      ...aggregatesTableResult,
      result: makeQueryResult([], {error: new QueryError('boom')}),
    };

    render(
      <TracesExportModalButton
        aggregatesTableResult={erroringAggregates}
        spansTableResult={{eventView, result: makeQueryResult([])}}
        rawSpanCounts={{
          normal: {count: 0, isLoading: false},
          total: {count: 0, isLoading: false},
        }}
      />,
      {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {location: {pathname: '/', query: {table: 'trace'}}},
      }
    );

    const button = screen.getByRole('button', {name: 'Export Data'});
    expect(button).toBeDisabled();

    await userEvent.hover(button);
    expect(
      screen.queryByText('Unable to export due to an error')
    ).not.toBeInTheDocument();
  });

  it('routes oversized aggregate exports to the server when more rows exist beyond the page', async () => {
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 9},
    });

    const fullAggregatePage: AggregatesTableResult = {
      ...aggregatesTableResult,
      result: makeQueryResult(
        Array.from({length: 50}, (_, i) => ({
          id: String(i),
          'span.description': 'GET /',
        })),
        {pageLinks: HAS_MORE_ROWS_LINK}
      ),
    };

    render(
      <TracesExportModalButton
        aggregatesTableResult={fullAggregatePage}
        spansTableResult={{eventView, result: makeQueryResult([])}}
        rawSpanCounts={{
          normal: {count: 0, isLoading: false},
          total: {count: 0, isLoading: false},
        }}
      />,
      {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {location: {pathname: '/', query: {mode: 'aggregate'}}},
      }
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/data-export/`,
        expect.objectContaining({
          data: expect.objectContaining({query_type: 'Explore', limit: 500}),
        })
      );
    });
    expect(downloadAsCsv).not.toHaveBeenCalled();
  });

  it('downloads a full aggregate page locally when it is the entire result set', async () => {
    const completeAggregatePage: AggregatesTableResult = {
      ...aggregatesTableResult,
      result: makeQueryResult(
        Array.from({length: 50}, (_, i) => ({
          id: String(i),
          'span.description': 'GET /',
        }))
      ),
    };

    render(
      <TracesExportModalButton
        aggregatesTableResult={completeAggregatePage}
        spansTableResult={{eventView, result: makeQueryResult([])}}
        rawSpanCounts={{
          normal: {count: 0, isLoading: false},
          total: {count: 0, isLoading: false},
        }}
      />,
      {
        organization,
        additionalWrapper: Wrapper,
        initialRouterConfig: {location: {pathname: '/', query: {mode: 'aggregate'}}},
      }
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(downloadAsCsv).toHaveBeenCalledTimes(1);
    });
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

  it('offers the server export when the Span count is unavailable', async () => {
    const dataExportMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      statusCode: 201,
      body: {id: 11},
    });

    renderButton({totalCount: null});

    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Number of rows'}));
    await userEvent.click(await screen.findByRole('option', {name: '10,000'}));
    await userEvent.click(screen.getByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(dataExportMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/data-export/`,
        expect.objectContaining({
          data: expect.objectContaining({query_type: 'Explore', limit: 10000}),
        })
      );
    });
    expect(downloadAsCsv).not.toHaveBeenCalled();
  });
});
