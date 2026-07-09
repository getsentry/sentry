import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {TagCollection} from 'sentry/types/group';
import {EventView} from 'sentry/utils/discover/eventView';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SpanFields} from 'sentry/views/insights/types';

import {AggregatesTable} from './aggregatesTable';

const stringTags: TagCollection = {
  'span.op': {
    key: 'span.op',
    name: 'span.op',
    kind: FieldKind.TAG,
  },
};

const numberTags: TagCollection = {
  'span.duration': {
    key: 'span.duration',
    name: 'span.duration',
    kind: FieldKind.MEASUREMENT,
  },
};

const booleanTags: TagCollection = {};

function createAggregatesQueryResult(
  overrides: Partial<AggregatesTableResult['result']> = {}
): AggregatesTableResult['result'] {
  return {
    data: [],
    isError: false,
    isFetched: true,
    isPending: false,
    meta: {
      fields: {
        'span.op': 'string',
        'count()': 'integer',
      },
      units: {},
    },
    pageLinks: undefined,
    ...overrides,
  } as unknown as AggregatesTableResult['result'];
}

function createAggregatesTableResult({
  result,
  ...overrides
}: Partial<Omit<AggregatesTableResult, 'result'>> & {
  result?: Partial<AggregatesTableResult['result']>;
} = {}): AggregatesTableResult {
  const eventView = EventView.fromLocation(
    LocationFixture({
      query: {
        field: ['span.op', 'count()'],
      },
    })
  );

  return {
    eventView,
    fields: ['span.op', 'count()'],
    result: createAggregatesQueryResult(result),
    ...overrides,
  };
}

function AggregatesTableWithParamsProvider({
  aggregatesTableResult,
  validatedFieldTypes = {},
}: {
  aggregatesTableResult: AggregatesTableResult;
  validatedFieldTypes?: Partial<Record<string, FieldValueType>>;
}) {
  return (
    <SpansQueryParamsProvider>
      <AggregatesTable
        aggregatesTableResult={aggregatesTableResult}
        stringTags={stringTags}
        numberTags={numberTags}
        booleanTags={booleanTags}
        validatedFieldTypes={validatedFieldTypes}
      />
    </SpansQueryParamsProvider>
  );
}

describe('AggregatesTable', () => {
  const {organization, project} = initializeOrg();

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/traces/`,
      query: {
        project: project.id,
        statsPeriod: '14d',
        groupBy: 'span.op',
        visualize: JSON.stringify({yAxes: ['count()']}),
        aggregateSort: '-count()',
        field: ['id', 'span.op', 'timestamp'],
      },
    },
    route: '/organizations/:orgId/explore/traces/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
      match: [
        (_url: string, options: {query?: Record<string, any>}) =>
          options.query?.itemType === TraceItemDataset.SPANS,
      ],
    });

    ProjectsStore.loadInitialData([project]);
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    });
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('opens a view samples dropdown from the samples icon', async () => {
    render(
      <AggregatesTableWithParamsProvider
        aggregatesTableResult={createAggregatesTableResult({
          result: {
            data: [
              {
                [`any(${SpanFields.TRACE})`]: 'trace-123',
                [`any(${SpanFields.TIMESTAMP})`]: 1712002518,
                'span.op': 'http',
                'count()': 10,
              },
            ],
            isError: false,
            isFetched: true,
            isPending: false,
            meta: {
              fields: {
                'span.op': 'string',
                'count()': 'integer',
              },
              units: {},
            },
            pageLinks: undefined,
          },
        })}
      />,
      {initialRouterConfig, organization}
    );

    await userEvent.click(screen.getAllByRole('button', {name: 'Actions'})[0]!);

    const viewSamplesItem = await screen.findByRole('menuitemradio', {
      name: 'View Samples',
    });
    expect(viewSamplesItem).toHaveAttribute(
      'href',
      expect.stringContaining('mode=samples')
    );
    expect(viewSamplesItem).toHaveAttribute(
      'href',
      expect.stringContaining('query=span.op%3Ahttp')
    );

    const viewRandomTraceItem = screen.getByRole('menuitemradio', {
      name: 'View Random Trace',
    });
    expect(viewRandomTraceItem).toHaveAttribute(
      'href',
      expect.stringContaining(
        `/organizations/${organization.slug}/explore/traces/trace/trace-123/`
      )
    );
    expect(viewRandomTraceItem).toHaveAttribute(
      'href',
      expect.stringContaining('timestamp=1712002518')
    );
    expect(viewRandomTraceItem).toHaveAttribute(
      'href',
      expect.stringContaining('source=traces')
    );
    expect(
      screen.queryByRole('menuitemradio', {name: 'Add to filter'})
    ).not.toBeInTheDocument();
  });

  it('uses validated field types for aggregate table actions', async () => {
    const eventView = EventView.fromLocation(
      LocationFixture({
        query: {
          field: ['sentry.duration', 'count()'],
        },
      })
    );

    render(
      <AggregatesTableWithParamsProvider
        validatedFieldTypes={{'sentry.duration': FieldValueType.NUMBER}}
        aggregatesTableResult={createAggregatesTableResult({
          eventView,
          result: {
            data: [
              {
                'sentry.duration': 123,
                'count()': 10,
              },
            ],
            meta: {
              fields: {
                'sentry.duration': FieldValueType.STRING,
                'count()': FieldValueType.INTEGER,
              },
              units: {},
            },
          },
        })}
      />,
      {
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {
              ...initialRouterConfig.location.query,
              groupBy: 'sentry.duration',
            },
          },
        },
        organization,
      }
    );

    await userEvent.click(screen.getByText('123'));

    expect(
      await screen.findByRole('menuitemradio', {name: 'Show values greater than'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Add to filter'})
    ).not.toBeInTheDocument();
  });
});
