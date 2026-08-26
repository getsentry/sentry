import type {ReactNode} from 'react';
import {QueryObserver} from '@tanstack/react-query';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {ResponseMeta} from 'sentry/types/api';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {EventView} from 'sentry/utils/discover/eventView';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {FieldValueType} from 'sentry/utils/fields';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {
  addValidatedFieldTypesToMeta,
  SpansTable,
} from 'sentry/views/explore/tables/spansTable';

jest.mock('sentry/utils/analytics');

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('addValidatedFieldTypesToMeta', () => {
  it('preserves table meta field types over validated field types', () => {
    const meta = addValidatedFieldTypesToMeta({
      meta: {
        fields: {
          'custom.duration': FieldValueType.STRING,
          id: FieldValueType.STRING,
        },
      },
      validatedFieldTypes: {
        'custom.duration': FieldValueType.NUMBER,
        'span.op': FieldValueType.STRING,
      },
    });

    expect(meta.fields).toEqual({
      'custom.duration': FieldValueType.STRING,
      id: FieldValueType.STRING,
      'span.op': FieldValueType.STRING,
    });
  });

  it('uses span field definitions over validated field types', () => {
    const meta = addValidatedFieldTypesToMeta({
      meta: {fields: {'span.duration': FieldValueType.NUMBER}},
      validatedFieldTypes: {'span.duration': FieldValueType.NUMBER},
    });

    expect(meta.fields?.['span.duration']).toBe(FieldValueType.DURATION);
  });

  it('types array columns from validated field types', () => {
    const meta = addValidatedFieldTypesToMeta({
      meta: {fields: {}},
      validatedFieldTypes: {'tags[my.tags,array]': FieldValueType.ARRAY},
    });

    expect(meta.fields?.['tags[my.tags,array]']).toBe(FieldValueType.ARRAY);
  });

  it('passes validated field types to table column metadata', () => {
    const eventView = EventView.fromLocation(
      LocationFixture({query: {field: ['sentry.duration']}})
    );
    const meta = addValidatedFieldTypesToMeta({
      meta: {fields: {}},
      validatedFieldTypes: {'sentry.duration': FieldValueType.NUMBER},
    });

    expect(eventView.getColumns(meta)[0]?.type).toBe(FieldValueType.NUMBER);
  });
});

describe('SpansTable', () => {
  const {organization, project} = initializeOrg({
    organization: {features: ['explore-span-item-details']},
  });

  const eventView = EventView.fromNewQueryWithLocation(
    {
      name: 'Span Samples',
      fields: [
        'id',
        'span.name',
        'span.description',
        'span.duration',
        'transaction',
        'timestamp',
        'project',
        'trace',
        'transaction.span_id',
      ],
      version: 2,
      query: '',
    },
    LocationFixture()
  );

  const firstRow = {
    id: 'aaaaaaaaaaaaaaaa',
    project: project.slug,
    trace: '11111111111111111111111111111111',
    timestamp: '2026-08-26T12:00:00Z',
    'span.name': 'span one',
    'span.description': 'GET /one',
    'span.duration': 100,
    transaction: 'transaction one',
  };
  const secondRow = {
    id: 'bbbbbbbbbbbbbbbb',
    project: project.slug,
    trace: '22222222222222222222222222222222',
    timestamp: '2026-08-26T12:01:00Z',
    'span.name': 'span two',
    'span.description': 'GET /two',
    'span.duration': 200,
    transaction: 'transaction two',
  };
  const rows = [firstRow, secondRow];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.mocked(trackAnalytics).mockClear();
    ProjectsStore.loadInitialData([
      ProjectFixture({
        ...project,
        organization: {id: organization.id, slug: organization.slug},
      }),
    ]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [Number(project.id)],
      environments: [],
      datetime: {period: '7d', start: null, end: null, utc: null},
    });
  });

  function renderTable({
    features = ['explore-span-item-details'],
    tableRows = rows,
  }: {features?: string[]; tableRows?: Array<Record<string, unknown>>} = {}) {
    return render(
      <SpansTable
        booleanTags={{}}
        numberTags={{}}
        spansTableResult={{eventView, result: makeQueryResult(tableRows)}}
        stringTags={{}}
        validatedFieldTypes={{}}
      />,
      {
        organization: {...organization, features},
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/traces/`,
          },
        },
      }
    );
  }

  function mockSpanDetails(
    row: (typeof rows)[number],
    attributes: TraceItemResponseAttribute[]
  ) {
    return MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${row.id}/`,
      match: [
        MockApiClient.matchQuery({
          item_type: 'spans',
          trace_id: row.trace,
          timestamp: new Date(row.timestamp).getTime() / 1000,
        }),
      ],
      body: {
        attributes,
        itemId: row.id,
        links: null,
        meta: {},
        timestamp: row.timestamp,
      },
    });
  }

  it('does not render or fetch span details when the feature is disabled', () => {
    const detailsMock = mockSpanDetails(firstRow, []);

    renderTable({features: []});

    expect(
      screen.queryByRole('button', {name: 'Show span details'})
    ).not.toBeInTheDocument();
    expect(detailsMock).not.toHaveBeenCalled();
  });

  it('independently expands span details only after clicking the chevrons', async () => {
    const firstDetailsMock = mockSpanDetails(firstRow, [
      {name: 'project_id', type: 'int', value: Number(project.id)},
      {name: 'received', type: 'float', value: 123},
      {name: 'is_segment', type: 'bool', value: false},
      {name: 'span.custom_one', type: 'str', value: 'first detail'},
    ]);
    const secondDetailsMock = mockSpanDetails(secondRow, [
      {name: 'span.custom_two', type: 'str', value: 'second detail'},
    ]);

    renderTable();

    const showButtons = screen.getAllByRole('button', {
      name: 'Show span details',
    });
    expect(firstDetailsMock).not.toHaveBeenCalled();
    expect(secondDetailsMock).not.toHaveBeenCalled();

    await userEvent.click(showButtons[0]!);
    expect(await screen.findByText('first detail')).toBeInTheDocument();
    expect(firstDetailsMock).toHaveBeenCalledTimes(1);
    expect(secondDetailsMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('tree-key-project_id')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tree-key-received')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tree-key-is_segment')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', {name: 'Show span details'})[0]!);
    expect(await screen.findByText('second detail')).toBeInTheDocument();
    expect(screen.getByText('first detail')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', {name: 'Hide span details'})[0]!);
    expect(screen.queryByText('first detail')).not.toBeInTheDocument();
    expect(screen.getByText('second detail')).toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalledWith(
      'trace_explorer.toggle_span_details',
      expect.objectContaining({expanded: false})
    );
  });

  it('offers filtering, column, and group-by actions for attributes', async () => {
    mockSpanDetails(firstRow, [
      {name: 'span.custom', type: 'str', value: 'custom value'},
    ]);

    const {router} = renderTable({tableRows: [firstRow]});
    await userEvent.click(screen.getByRole('button', {name: 'Show span details'}));

    const attributeKey = await screen.findByTestId('tree-key-span.custom');
    const attributeRow = attributeKey.closest<HTMLElement>(
      '[data-test-id="attribute-tree-row"]'
    );
    expect(attributeRow).not.toBeNull();
    await userEvent.hover(attributeRow!);
    await userEvent.click(
      within(attributeRow!).getByRole('button', {
        name: 'Attribute Actions Menu',
      }),
      {pointerEventsCheck: 0}
    );

    expect(await screen.findByText('Add to filter')).toBeInTheDocument();
    expect(screen.getByText('Exclude this value')).toBeInTheDocument();
    expect(screen.getByText('Add this as table column')).toBeInTheDocument();
    expect(screen.getByText('Group by attribute')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Add this as table column'));
    await waitFor(() => {
      expect(router.location.query.field).toEqual(
        expect.arrayContaining(['span.custom'])
      );
    });
    expect(screen.getByRole('button', {name: 'Show span details'})).toBeInTheDocument();
  });

  it('retries a failed span details request without collapsing the row', async () => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${firstRow.id}/`,
      statusCode: 500,
      body: {detail: 'Internal error'},
    });

    renderTable({tableRows: [firstRow]});
    await userEvent.click(screen.getByRole('button', {name: 'Show span details'}));
    expect(await screen.findByText('Failed to load span details')).toBeInTheDocument();

    mockSpanDetails(firstRow, [
      {name: 'span.recovered', type: 'str', value: 'recovered detail'},
    ]);
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(await screen.findByText('recovered detail')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Hide span details'})).toBeInTheDocument();
  });

  it('shows an empty state when no visible attributes are returned', async () => {
    mockSpanDetails(firstRow, [
      {name: 'project_id', type: 'int', value: Number(project.id)},
      {name: 'received', type: 'float', value: 123},
      {name: 'is_segment', type: 'bool', value: false},
    ]);

    renderTable({tableRows: [firstRow]});
    await userEvent.click(screen.getByRole('button', {name: 'Show span details'}));

    expect(
      await screen.findByText('No attributes found for this span')
    ).toBeInTheDocument();
  });

  it('does not link empty span detail identifiers', async () => {
    mockSpanDetails(firstRow, [
      {name: 'profile.id', type: 'str', value: ''},
      {name: 'replayId', type: 'str', value: ''},
      {name: 'trace', type: 'str', value: ''},
    ]);

    renderTable({tableRows: [firstRow]});
    await userEvent.click(screen.getByRole('button', {name: 'Show span details'}));

    const attributesTree = await screen.findByTestId('fields-tree');
    expect(within(attributesTree).queryByRole('link')).not.toBeInTheDocument();
  });
});

function makeQueryResult(
  data: Array<Record<string, unknown>>
): SpansTableResult['result'] {
  const queryClient = makeTestQueryClient();
  const queryKey = ['spans-table-test'];
  queryClient.setQueryData(queryKey, [{data: []}, undefined, undefined]);

  const base = new QueryObserver<
    [TableData, string | undefined, ResponseMeta<TableData> | undefined],
    QueryError
  >(queryClient, {queryKey, enabled: false}).getCurrentResult();

  return {
    // eslint-disable-next-line @tanstack/query/no-rest-destructuring
    ...base,
    data,
    error: null,
    statusCode: undefined,
    response: undefined,
    meta: {
      fields: {
        id: FieldValueType.STRING,
        'span.name': FieldValueType.STRING,
        'span.description': FieldValueType.STRING,
        'span.duration': FieldValueType.DURATION,
        transaction: FieldValueType.STRING,
        timestamp: FieldValueType.DATE,
      },
      units: {},
    },
    pageLinks: undefined,
  };
}
