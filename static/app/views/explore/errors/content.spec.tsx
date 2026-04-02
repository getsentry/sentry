import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import ErrorsContent from './content';

describe('ErrorsContent', () => {
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
      method: 'GET',
      body: [ProjectFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      method: 'GET',
      body: [],
    });
  });

  it('renders the Errors page title', async () => {
    const organization = OrganizationFixture();
    render(<ErrorsContent />, {organization});
    expect(await screen.findByText('Errors')).toBeInTheDocument();
  });

  it('renders page filter bar with project, environment, and date filters', async () => {
    const organization = OrganizationFixture();
    render(<ErrorsContent />, {organization});

    expect(await screen.findByTestId('page-filter-project-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-environment-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-timerange-selector')).toBeInTheDocument();
  });

  it('renders the search query builder', async () => {
    const organization = OrganizationFixture();
    render(<ErrorsContent />, {organization});

    expect(
      await screen.findByRole('combobox', {name: /add a search term/i})
    ).toBeInTheDocument();
  });
});
