import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {ErrorsFilterSection} from './filterContent';

describe('ErrorsFilterSection', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: false},
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
  });

  it('does not render schema hints', async () => {
    render(<ErrorsFilterSection />);

    await screen.findByRole('combobox');
    expect(screen.queryByText('See full list')).not.toBeInTheDocument();
  });
});
