import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';

import {useShowConversationOnboarding} from './useShowConversationOnboarding';

const organization = OrganizationFixture();
const storageKey = `conversations:projects-with-data:${organization.slug}`;
const eventsUrl = `/organizations/${organization.slug}/events/`;

function mockConversations(data: Array<{id: string}>) {
  return MockApiClient.addMockResponse({
    url: eventsUrl,
    match: [MockApiClient.matchQuery({query: 'has:gen_ai.conversation.id'})],
    body: {data},
  });
}

function mockAgentSpans(data: Array<{id: string}>) {
  return MockApiClient.addMockResponse({
    url: eventsUrl,
    match: [
      MockApiClient.matchQuery({
        query: '(has:gen_ai.operation.type OR has:gen_ai.conversation.id)',
      }),
    ],
    body: {data},
  });
}

function selectProjects(projects: number[]) {
  PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects}));
}

function knownConversations(projects: number[]) {
  localStorage.setItem(storageKey, JSON.stringify(projects));
}

describe('useShowConversationOnboarding', () => {
  beforeEach(() => {
    PageFiltersStore.reset();
    ProjectsStore.reset();
    localStorage.clear();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', hasInsightsAgentMonitoring: false}),
      ProjectFixture({id: '2', hasInsightsAgentMonitoring: false}),
    ]);
    selectProjects([1]);
    mockConversations([]);
    mockAgentSpans([]);
  });

  afterEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
  });

  it('shows onboarding only after both empty checks complete', async () => {
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.showOnboarding).toBe(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.showOnboarding).toBe(true);
    expect(result.current.hasConversations).toBe(false);
    expect(result.current.hasAgenticSpans).toBe(false);
  });

  it('reports agentic spans without conversations from the project flag', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', hasInsightsAgentMonitoring: true}),
    ]);
    const agentSpansRequest = mockAgentSpans([]);
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAgenticSpans).toBe(true);
    expect(result.current.hasConversations).toBe(false);
    expect(agentSpansRequest).not.toHaveBeenCalled();
  });

  it('reports AI spans without a project flag or conversation ID', async () => {
    mockAgentSpans([{id: 'llm-span'}]);
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasAgenticSpans).toBe(true);
    expect(result.current.hasConversations).toBe(false);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('detects conversations without a project flag and stores the selection', async () => {
    const request = mockConversations([{id: 'conversation-span'}]);
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    await waitFor(() => expect(result.current.hasConversations).toBe(true));
    expect(result.current.hasAgenticSpans).toBe(true);
    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual([1]);
    expect(request).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: ['id'],
          per_page: 1,
          project: [1],
          referrer: Referrer.ONBOARDING,
        }),
      })
    );
  });

  it('keeps known conversations visible even when the current window is empty', async () => {
    knownConversations([1]);
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    expect(result.current.hasConversations).toBe(true);
    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => expect(result.current.hasAgenticSpans).toBe(true));
  });

  it('does not use another project’s conversation history', async () => {
    knownConversations([1]);
    selectProjects([2]);
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    await waitFor(() => expect(result.current.showOnboarding).toBe(true));
    expect(result.current.hasConversations).toBe(false);
  });

  it('merges newly detected projects with conversation history', async () => {
    knownConversations([1]);
    selectProjects([2]);
    mockConversations([{id: 'conversation-span'}]);
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    await waitFor(() => expect(result.current.hasConversations).toBe(true));
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual([1, 2]);
  });

  it.each([{projects: []}, {projects: [ALL_ACCESS_PROJECTS]}])(
    'stores the all-projects sentinel for selection $projects',
    async ({projects}) => {
      selectProjects(projects);
      mockConversations([{id: 'conversation-span'}]);
      const {result} = renderHookWithProviders(useShowConversationOnboarding, {
        organization,
      });

      await waitFor(() => expect(result.current.hasConversations).toBe(true));
      expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual([
        ALL_ACCESS_PROJECTS,
      ]);
    }
  );

  it.each([{projects: [ALL_ACCESS_PROJECTS]}, {projects: [1]}])(
    'uses known conversation history $projects for all projects',
    async ({projects}) => {
      selectProjects([]);
      knownConversations(projects);
      const {result} = renderHookWithProviders(useShowConversationOnboarding, {
        organization,
      });

      expect(result.current.hasConversations).toBe(true);
      expect(result.current.isLoading).toBe(false);
      await waitFor(() => expect(result.current.showOnboarding).toBe(false));
    }
  );

  it('does not let the all-projects sentinel suppress a specific project’s onboarding', async () => {
    knownConversations([ALL_ACCESS_PROJECTS]);
    selectProjects([2]);
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    await waitFor(() => expect(result.current.showOnboarding).toBe(true));
  });

  it('does not treat a failed availability check as missing instrumentation', async () => {
    MockApiClient.addMockResponse({
      url: eventsUrl,
      statusCode: 500,
      body: {detail: 'Unavailable'},
    });
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.showOnboarding).toBe(false);
  });

  it('refetches both availability checks after onboarding', async () => {
    const {result} = renderHookWithProviders(useShowConversationOnboarding, {
      organization,
    });
    await waitFor(() => expect(result.current.showOnboarding).toBe(true));
    mockAgentSpans([{id: 'new-llm-span'}]);

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.hasAgenticSpans).toBe(true));
    expect(result.current.hasConversations).toBe(false);
  });
});
