import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {MAX_PERIOD_FOR_CROSS_EVENTS} from 'sentry/views/explore/constants';

import {ExploreContent} from './content';

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

  describe('cross events', () => {
    it('renders with cross events', async () => {
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

    it('resets period when max pickable days decreases', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      });

      const {router} = render(<ExploreContent />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {
              statsPeriod: '14d',
            },
          },
        },
      });

      await screen.findByText('Traces');

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection.datetime).toEqual({
          period: '14d',
          start: null,
          end: null,
          utc: null,
        })
      );

      act(() => {
        router.navigate({
          pathname: '/organizations/org-slug/explore/traces/',
          search: `statsPeriod=14d&crossEvents=${encodeURIComponent(
            JSON.stringify([{query: '', type: 'spans'}])
          )}`,
        });
      });

      await waitFor(() =>
        expect(PageFiltersStore.getState().selection.datetime).toEqual({
          period: MAX_PERIOD_FOR_CROSS_EVENTS,
          start: null,
          end: null,
          utc: null,
        })
      );
    });
  });
});
