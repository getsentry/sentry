import type {ReactNode} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

import {SpanTabSearchSection} from './spansTabSearchSection';

jest.mock('sentry/views/explore/hooks/useTraceItemAttributes', () => ({
  useSpanItemAttributes: () => ({attributes: {}, isLoading: false, secondaryAliases: {}}),
}));

const mockUseExploreSchemaHintsRemoval = jest.fn();

jest.mock('sentry/views/explore/useExploreSchemaHintsRemoval', () => ({
  get useExploreSchemaHintsRemoval() {
    return mockUseExploreSchemaHintsRemoval;
  },
}));

const datePageFilterProps: DatePageFilterProps = {
  defaultPeriod: '7d' as const,
  maxPickableDays: 7,
  relativeOptions: ({arbitraryOptions}) => arbitraryOptions,
};

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

describe('SpanTabSearchSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '7d', start: null, end: null, utc: false},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: {},
    });
  });

  it('shows schema hints when hook returns false', async () => {
    mockUseExploreSchemaHintsRemoval.mockReturnValue(false);

    render(<SpanTabSearchSection datePageFilterProps={datePageFilterProps} />, {
      additionalWrapper: Wrapper,
    });

    expect(await screen.findByText('See full list')).toBeInTheDocument();
  });

  it('hides schema hints when hook returns true', async () => {
    mockUseExploreSchemaHintsRemoval.mockReturnValue(true);

    render(<SpanTabSearchSection datePageFilterProps={datePageFilterProps} />, {
      additionalWrapper: Wrapper,
    });

    await screen.findByRole('combobox');
    expect(screen.queryByText('See full list')).not.toBeInTheDocument();
  });
});
