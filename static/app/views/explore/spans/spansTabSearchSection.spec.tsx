import type {ReactNode} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

import {SpanTabSearchSection} from './spansTabSearchSection';

jest.mock('sentry/views/explore/hooks/useTraceItemAttributes', () => ({
  useSpanItemAttributes: () => ({attributes: {}, isLoading: false, secondaryAliases: {}}),
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

  it('does not render schema hints', async () => {
    render(<SpanTabSearchSection datePageFilterProps={datePageFilterProps} />, {
      additionalWrapper: Wrapper,
    });

    await screen.findByRole('combobox');
    expect(screen.queryByText('See full list')).not.toBeInTheDocument();
  });
});
