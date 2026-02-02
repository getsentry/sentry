import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as pageFiltersActionCreators from 'sentry/actionCreators/pageFilters';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';

import {ExploreContent} from './content';

jest.mock('sentry/actionCreators/pageFilters', () => ({
  ...jest.requireActual('sentry/actionCreators/pageFilters'),
  updateDateTime: jest.fn(),
}));

describe('ExploreContent', () => {
  const {organization, project} = initializeOrg({
    organization: {
      features: ['gen-ai-features', 'traces-page-cross-event-querying'],
    },
  });

  beforeEach(() => {
    // Suppress console errors from CompactSelect async updates
    jest.spyOn(console, 'error').mockImplementation();

    PageFiltersStore.init();

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/setup-check/`,
      body: AutofixSetupFixture({
        setupAcknowledgement: {
          orgHasAcknowledged: true,
          userHasAcknowledged: true,
        },
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
      match: [MockApiClient.matchQuery({attributeType: 'number'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          key: 'project',
          name: 'project',
          attributeSource: {source_type: 'sentry'},
        },
      ],
      match: [MockApiClient.matchQuery({attributeType: 'string'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: `/assistant/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('cross events date restriction', () => {
    it('renders with cross events and applies 7 day date restriction', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '7d', start: null, end: null, utc: null},
      });

      render(<ExploreContent />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              crossEvents: JSON.stringify([{query: '', type: 'spans'}]),
            },
          },
        },
      });

      // Component renders successfully with cross events
      expect(await screen.findByText('Traces')).toBeInTheDocument();

      // The add cross event button should be visible
      expect(
        screen.getByRole('button', {name: 'Add a cross event query'})
      ).toBeInTheDocument();
    });

    it('auto-adjusts period to 7d when cross events present and period exceeds 7 days', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      });

      render(<ExploreContent />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              crossEvents: JSON.stringify([{query: '', type: 'spans'}]),
            },
          },
        },
      });

      await waitFor(() => {
        expect(pageFiltersActionCreators.updateDateTime).toHaveBeenCalledWith({
          period: '7d',
          start: null,
          end: null,
          utc: null,
        });
      });
    });

    it('does not adjust period when cross events present and period is within 7 days', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '7d', start: null, end: null, utc: null},
      });

      render(<ExploreContent />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              crossEvents: JSON.stringify([{query: '', type: 'spans'}]),
            },
          },
        },
      });

      // Wait for component to fully render
      await screen.findByText('Traces');

      expect(pageFiltersActionCreators.updateDateTime).not.toHaveBeenCalled();
    });

    it('does not adjust period when no cross events present', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      });

      render(<ExploreContent />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {},
          },
        },
      });

      // Wait for component to fully render
      await screen.findByText('Traces');

      expect(pageFiltersActionCreators.updateDateTime).not.toHaveBeenCalled();
    });
  });
});
