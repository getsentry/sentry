import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';

import {AgentsTable} from './agentsTable';

const organization = OrganizationFixture();
const project = ProjectFixture({id: '1'});

const LLM_CALLS_FIELDS = [
  'id',
  'gen_ai.output.messages',
  'gen_ai.response.model',
  'gen_ai.cost.total_tokens',
  'timestamp',
];

describe('AgentsTable', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [Number(project.id)],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      body: {
        dataset: [],
        environment: [],
        field: [],
        orderby: [],
        projects: [],
        query: {error: null, fields: [], valid: true},
        valid: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
  });

  afterEach(() => {
    PageFiltersStore.reset();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('uses the LLM Calls saved query columns for agent spans', async () => {
    const spansRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [], meta: {dataScanned: 'full'}},
    });

    render(
      <AgentsTable
        activeTab="spans"
        hasAgenticSpans
        hasConversations={false}
        onConversationOnboardingDismiss={jest.fn()}
        onTabChange={jest.fn()}
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/explore/agents/`,
          },
        },
      }
    );

    expect(await screen.findByTestId('spans-table')).toBeInTheDocument();
    await waitFor(() =>
      expect(spansRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            field: expect.arrayContaining(LLM_CALLS_FIELDS),
          }),
        })
      )
    );
    expect(spansRequest).not.toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({field: expect.arrayContaining(['span.name'])}),
      })
    );
  });
});
