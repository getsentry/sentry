import {useEffect, useState, type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  LLMContextProvider,
  useLLMContext,
} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

import {useChatSuggestions} from './useChatSuggestions';

const DEFAULT_FALLBACK_SUGGESTIONS = [
  {text: "Walk me through what's on my screen and what I can focus on next."},
  {text: 'Which of my open issues are getting worse, not better?'},
  {text: 'What else should I set up to get more out of Sentry?'},
];

const ISSUE_FALLBACK_SUGGESTIONS = [
  {text: "What's the likely root cause of this issue?"},
  {text: 'When did this start, and what changed around then?'},
  {text: 'Are other issues failing for the same reason?'},
];

const IssueDetailNode = registerLLMContext(
  'issue-detail',
  ({children}: {children?: ReactNode}) => children
);

function IssueDetailPage({children}: {children?: ReactNode}) {
  return (
    <LLMContextProvider>
      <IssueDetailNode>{children}</IssueDetailNode>
    </LLMContextProvider>
  );
}

const LoadedIssueDetailNode = registerLLMContext('issue-detail', () => {
  useLLMContext({shortId: 'ISSUE-1'});
  return null;
});

function makeSlowIssueDetailPage(loadAfterMs: number) {
  return function SlowIssueDetailPage({children}: {children?: ReactNode}) {
    const [isLoaded, setIsLoaded] = useState(false);
    useEffect(() => {
      const timeoutId = window.setTimeout(() => setIsLoaded(true), loadAfterMs);
      return () => window.clearTimeout(timeoutId);
    }, []);
    return (
      <LLMContextProvider>
        {isLoaded && <LoadedIssueDetailNode />}
        {children}
      </LLMContextProvider>
    );
  };
}

describe('useChatSuggestions', () => {
  const organization = OrganizationFixture({
    features: ['seer-chat-suggestions'],
  });
  const url = `/organizations/${organization.slug}/seer/chat-suggestions/`;
  const issuePageRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/1/`,
    },
    route: '/organizations/:orgId/',
    children: [
      {
        path: 'issues/:groupId/',
        element: null,
        handle: {path: '/issues/:groupId/'},
      },
    ],
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', hasInsightsDb: false})]);
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}));
  });

  it('returns legacy suggestions when the flag is off', () => {
    const request = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {},
    });

    const {result} = renderHookWithProviders(
      () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
      {
        organization: OrganizationFixture(),
        additionalWrapper: LLMContextProvider,
      }
    );

    expect(result.current).toEqual({
      isLoading: false,
      source: 'legacy',
      suggestions: [
        {text: 'Which of my open issues are getting worse, not better?'},
        {text: 'What are my slowest DB queries?'},
        {
          text: "Walk me through what's on my screen and what I can focus on next.",
        },
      ],
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('does not generate suggestions when disabled', () => {
    const request = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {},
    });

    renderHookWithProviders(
      () => useChatSuggestions({enabled: false, allowStructuredContext: false}),
      {organization, additionalWrapper: LLMContextProvider}
    );

    expect(request).not.toHaveBeenCalled();
  });

  it('returns generated suggestions when the request succeeds', async () => {
    const suggestions = [
      {
        text: 'Which of these issues started after the last release?',
        kind: 'question',
      },
      {
        text: 'Email me when this issue regresses',
        kind: 'action',
        action_type: 'sentry.api.create_organization_workflow',
      },
    ];
    const request = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {suggestions},
    });

    const {result} = renderHookWithProviders(
      () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
      {organization, additionalWrapper: LLMContextProvider}
    );

    expect(result.current).toEqual({isLoading: true});
    await waitFor(() =>
      expect(result.current).toEqual({
        isLoading: false,
        source: 'generated',
        suggestions,
      })
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          route: expect.any(String),
          route_params: expect.any(Object),
          page_context: expect.any(String),
          project_ids: [1],
        },
      })
    );
  });

  it('returns fallback suggestions when the response is empty', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {suggestions: []},
    });

    const {result} = renderHookWithProviders(
      () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
      {organization, additionalWrapper: LLMContextProvider}
    );

    await waitFor(() =>
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: DEFAULT_FALLBACK_SUGGESTIONS,
      })
    );
  });

  it('returns fallback suggestions when the request fails', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 502,
      body: {detail: 'Failed to generate suggestions'},
    });

    const {result} = renderHookWithProviders(
      () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
      {organization, additionalWrapper: LLMContextProvider}
    );

    await waitFor(() =>
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: DEFAULT_FALLBACK_SUGGESTIONS,
      })
    );
  });

  describe('timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      act(() => jest.runOnlyPendingTimers());
      jest.useRealTimers();
    });

    it('returns fallback suggestions when the request times out', async () => {
      MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: [{text: 'Too late'}]},
        asyncDelay: new Promise(() => {}),
      });

      const {result} = renderHookWithProviders(
        () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
        {organization, additionalWrapper: LLMContextProvider}
      );

      expect(result.current).toEqual({isLoading: true});
      await act(() => jest.advanceTimersByTimeAsync(5000));
      await waitFor(() =>
        expect(result.current).toEqual({
          isLoading: false,
          source: 'fallback',
          suggestions: DEFAULT_FALLBACK_SUGGESTIONS,
        })
      );
    });

    it('returns fallback suggestions when the request finishes after the timeout', async () => {
      MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: [{text: 'Late'}]},
        asyncDelay: new Promise(resolve => window.setTimeout(resolve, 7000)),
      });

      const {result} = renderHookWithProviders(
        () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
        {organization, additionalWrapper: LLMContextProvider}
      );

      await act(() => jest.advanceTimersByTimeAsync(5000));
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: DEFAULT_FALLBACK_SUGGESTIONS,
      });

      await act(() => jest.advanceTimersByTimeAsync(2000));
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: DEFAULT_FALLBACK_SUGGESTIONS,
      });
    });

    it('returns generated suggestions when navigating to another page after a timeout', async () => {
      MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: [{text: 'Too late'}]},
        asyncDelay: new Promise(() => {}),
      });

      const {result, router} = renderHookWithProviders(
        () => useChatSuggestions({enabled: true, allowStructuredContext: true}),
        {
          organization,
          additionalWrapper: IssueDetailPage,
          initialRouterConfig: issuePageRouterConfig,
        }
      );

      await act(() => jest.advanceTimersByTimeAsync(5000));
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: ISSUE_FALLBACK_SUGGESTIONS,
      });

      MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: [{text: 'Issue 2'}]},
      });
      router.navigate(`/organizations/${organization.slug}/issues/2/`);

      await waitFor(() =>
        expect(result.current).toEqual({
          isLoading: false,
          source: 'generated',
          suggestions: [{text: 'Issue 2'}],
        })
      );
    });
  });

  it('returns issue fallback suggestions when on an issue page', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {suggestions: []},
    });

    const {result} = renderHookWithProviders(
      () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
      {
        organization,
        additionalWrapper: IssueDetailPage,
        initialRouterConfig: issuePageRouterConfig,
      }
    );

    await waitFor(() =>
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: ISSUE_FALLBACK_SUGGESTIONS,
      })
    );
  });

  describe('page loading', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      act(() => jest.runOnlyPendingTimers());
      jest.useRealTimers();
    });

    it('returns fallback suggestions when the page never loads', async () => {
      const request = MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: [{text: 'Generated'}]},
      });

      const {result} = renderHookWithProviders(
        () => useChatSuggestions({enabled: true, allowStructuredContext: true}),
        {
          organization,
          additionalWrapper: LLMContextProvider,
          initialRouterConfig: issuePageRouterConfig,
        }
      );

      expect(result.current).toEqual({isLoading: true});
      await act(() => jest.advanceTimersByTimeAsync(5000));
      await waitFor(() =>
        expect(result.current).toEqual({
          isLoading: false,
          source: 'fallback',
          suggestions: ISSUE_FALLBACK_SUGGESTIONS,
        })
      );
      expect(request).not.toHaveBeenCalled();
    });

    it('returns fallback suggestions when the page finishes loading after the timeout', async () => {
      const request = MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: [{text: 'Generated'}]},
      });

      const {result} = renderHookWithProviders(
        () => useChatSuggestions({enabled: true, allowStructuredContext: true}),
        {
          organization,
          additionalWrapper: makeSlowIssueDetailPage(6000),
          initialRouterConfig: issuePageRouterConfig,
        }
      );

      await act(() => jest.advanceTimersByTimeAsync(5000));
      expect(request).not.toHaveBeenCalled();
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: ISSUE_FALLBACK_SUGGESTIONS,
      });

      await act(() => jest.advanceTimersByTimeAsync(1000));
      await waitFor(() => expect(request).toHaveBeenCalled());
      expect(result.current).toEqual({
        isLoading: false,
        source: 'fallback',
        suggestions: ISSUE_FALLBACK_SUGGESTIONS,
      });
    });

    it('returns generated suggestions when the page finishes loading', async () => {
      const request = MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: [{text: 'Generated'}]},
      });

      const {result} = renderHookWithProviders(
        () => useChatSuggestions({enabled: true, allowStructuredContext: true}),
        {
          organization,
          additionalWrapper: makeSlowIssueDetailPage(500),
          initialRouterConfig: issuePageRouterConfig,
        }
      );

      await act(() => jest.advanceTimersByTimeAsync(400));
      expect(request).not.toHaveBeenCalled();

      await act(() => jest.advanceTimersByTimeAsync(100));
      await waitFor(() =>
        expect(result.current).toEqual({
          isLoading: false,
          source: 'generated',
          suggestions: [{text: 'Generated'}],
        })
      );
      expect(request).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          data: expect.objectContaining({
            page_context: expect.stringContaining('ISSUE-1'),
          }),
        })
      );
    });
  });

  it.each([
    {
      name: 'a selected project has DB data',
      selected: [2],
      projects: [ProjectFixture({id: '2', hasInsightsDb: true})],
      expected: 'What are my slowest DB queries?',
    },
    {
      name: 'only an unselected project has DB data',
      selected: [1],
      projects: [
        ProjectFixture({id: '1', hasInsightsDb: false}),
        ProjectFixture({id: '2', hasInsightsDb: true}),
      ],
      expected: 'What else should I set up to get more out of Sentry?',
    },
    {
      name: 'a member project has DB data and My Projects is selected',
      selected: [],
      projects: [ProjectFixture({id: '2', hasInsightsDb: true, isMember: true})],
      expected: 'What are my slowest DB queries?',
    },
    {
      name: 'only a non-member project has DB data and All Projects is selected',
      selected: [ALL_ACCESS_PROJECTS],
      projects: [ProjectFixture({id: '2', hasInsightsDb: true, isMember: false})],
      expected: 'What else should I set up to get more out of Sentry?',
    },
  ])(
    'includes "$expected" fallback when $name',
    async ({selected, projects, expected}) => {
      ProjectsStore.loadInitialData(projects);
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: selected}));
      MockApiClient.addMockResponse({
        url,
        method: 'POST',
        body: {suggestions: []},
      });

      const {result} = renderHookWithProviders(
        () => useChatSuggestions({enabled: true, allowStructuredContext: false}),
        {organization, additionalWrapper: LLMContextProvider}
      );

      await waitFor(() =>
        expect(result.current).toEqual({
          isLoading: false,
          source: 'fallback',
          suggestions: [...DEFAULT_FALLBACK_SUGGESTIONS.slice(0, 2), {text: expected}],
        })
      );
    }
  );
});
