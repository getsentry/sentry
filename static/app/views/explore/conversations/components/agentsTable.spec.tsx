import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {useConversations} from 'sentry/views/explore/conversations/hooks/useConversations';

import {AgentsTable, LLM_CALLS_SAVED_QUERY} from './agentsTable';

const organization = OrganizationFixture();
const project = ProjectFixture({id: '1'});

const conversationsResult = {
  data: [],
  isFetching: false,
  error: null,
  pageLinks: undefined,
  setCursor: jest.fn(),
  unsetCursor: jest.fn(),
  isDirectHit: false,
  sort: '-conversation.age',
  setSort: jest.fn(),
} satisfies ReturnType<typeof useConversations>;

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
        conversations={conversationsResult}
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
    expect(screen.getByRole('tab', {name: 'LLM Calls'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await waitFor(() =>
      expect(spansRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            field: expect.arrayContaining(LLM_CALLS_SAVED_QUERY.fields),
            query: LLM_CALLS_SAVED_QUERY.query,
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
