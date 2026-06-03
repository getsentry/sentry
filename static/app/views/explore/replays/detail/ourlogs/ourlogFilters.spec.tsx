import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {FieldKind} from 'sentry/utils/fields';
import {useTraceItemSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {OurLogFilters} from 'sentry/views/explore/replays/detail/ourlogs/ourlogFilters';
import {TraceItemDataset} from 'sentry/views/explore/types';

const baseSearchQueryBuilderProps = {
  itemType: TraceItemDataset.LOGS as TraceItemDataset.LOGS,
  booleanAttributes: {},
  booleanSecondaryAliases: {},
  numberAttributes: {},
  numberSecondaryAliases: {},
  stringAttributes: {
    'log.message': {key: 'log.message', name: 'log.message', kind: FieldKind.TAG},
  },
  stringSecondaryAliases: {},
  initialQuery: '',
  searchSource: 'ourlogs' as const,
  onSearch: jest.fn(),
};

function Wrapper({children}: {children: React.ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.REPLAY_DETAILS}
      source="state"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

function TestOurLogFilters() {
  const searchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps(
    baseSearchQueryBuilderProps
  );
  return (
    <OurLogFilters
      searchQueryBuilderProps={baseSearchQueryBuilderProps}
      searchQueryBuilderProviderProps={searchQueryBuilderProviderProps}
    />
  );
}

describe('OurLogFilters', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: false},
    });
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {attributes: {}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('renders with replay-specific placeholder text', async () => {
    const organization = OrganizationFixture({features: ['visibility-explore-view']});

    render(
      <Wrapper>
        <TestOurLogFilters />
      </Wrapper>,
      {organization}
    );

    expect(
      await screen.findByPlaceholderText('Search on log levels, messages, and more')
    ).toBeInTheDocument();
  });

  it('renders the Open in Logs button when explore feature is enabled', async () => {
    const organization = OrganizationFixture({features: ['visibility-explore-view']});

    render(
      <Wrapper>
        <TestOurLogFilters />
      </Wrapper>,
      {organization}
    );

    expect(await screen.findByRole('button', {name: 'Open in Logs'})).toBeInTheDocument();
  });

  it('does not render the Open in Logs button when explore feature is disabled', async () => {
    const organization = OrganizationFixture({features: []});

    render(
      <Wrapper>
        <TestOurLogFilters />
      </Wrapper>,
      {organization}
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', {name: 'Open in Logs'})).not.toBeInTheDocument()
    );
  });
});
