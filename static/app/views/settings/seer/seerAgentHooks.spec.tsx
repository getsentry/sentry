import {useQueryClient} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import type {SeerPreferencesResponse} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {
  CodingAgentProvider,
  type ProjectSeerPreferences,
} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  useMutateSelectedAgent,
  useSelectedAgentFromBulkSettings,
} from 'sentry/views/settings/seer/seerAgentHooks';

describe('seerAgentHooks', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const project = ProjectFixture({slug: 'project-slug', id: '1'});

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ProjectsStore.reset();
  });

  describe('useSelectedAgentFromBulkSettings', () => {
    it('returns "seer" when automationHandoff undefined, doesnt look at autofixAutomationTuning', () => {
      const {result} = renderHookWithProviders(useSelectedAgentFromBulkSettings, {
        initialProps: {
          autofixSettings: {
            projectId: '1',
            autofixAutomationTuning: 'off',
            automatedRunStoppingPoint: undefined,
            automationHandoff: undefined,
            reposCount: 0,
          },
          integrations: [],
        },
        organization,
      });

      expect(result.current).toBe('seer');
    });

    it('returns "seer" when no automationHandoff integration_id', () => {
      const {result} = renderHookWithProviders(useSelectedAgentFromBulkSettings, {
        initialProps: {
          autofixSettings: {
            projectId: '1',
            autofixAutomationTuning: 'medium',
            automatedRunStoppingPoint: undefined,
            automationHandoff: undefined,
            reposCount: 0,
          },
          integrations: [],
        },
        organization,
      });

      expect(result.current).toBe('seer');
    });

    it('returns matching integration when automationHandoff has integration_id', () => {
      const integrations: CodingAgentIntegration[] = [
        {id: '99', name: 'Cursor', provider: 'cursor'},
      ];

      const {result} = renderHookWithProviders(useSelectedAgentFromBulkSettings, {
        initialProps: {
          autofixSettings: {
            projectId: '1',
            autofixAutomationTuning: 'medium',
            automatedRunStoppingPoint: undefined,
            automationHandoff: {
              handoff_point: 'root_cause',
              target: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
              integration_id: 99,
            },
            reposCount: 0,
          },
          integrations,
        },
        organization,
      });

      expect(result.current).toMatchObject({id: '99', name: 'Cursor'});
    });
  });

  describe('useMutateSelectedAgent', () => {
    const basePreference: ProjectSeerPreferences = {
      repositories: [],
      automated_run_stopping_point: 'code_changes',
      automation_handoff: undefined,
    };

    const queryKey = bulkAutofixAutomationSettingsInfiniteOptions({
      organization,
    }).queryKey;

    function makeInitialCacheData() {
      return {
        pages: [
          {
            json: [
              {
                projectId: '1',
                autofixAutomationTuning: 'off' as const,
                automatedRunStoppingPoint: 'code_changes' as const,
                automationHandoff: undefined,
                reposCount: 2,
              },
              {
                projectId: '2',
                autofixAutomationTuning: 'medium' as const,
                automatedRunStoppingPoint: 'open_pr' as const,
                automationHandoff: undefined,
                reposCount: 1,
              },
            ],
            headers: {
              Link: undefined,
              'X-Hits': undefined,
              'X-Max-Hits': undefined,
            },
          },
        ],
        pageParams: [undefined],
      };
    }

    function setupMocks(preference: ProjectSeerPreferences = basePreference) {
      const seerPreferencesGetRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference,
          code_mapping_repos: [],
        } satisfies SeerPreferencesResponse,
      });
      const projectPutRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        body: project,
      });
      const seerPreferencesPostRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        body: {},
      });
      return {seerPreferencesGetRequest, projectPutRequest, seerPreferencesPostRequest};
    }

    function renderMutateSelectedAgent() {
      return renderHookWithProviders(
        (props: {project: typeof project}) => {
          const queryClient = useQueryClient();
          const mutate = useMutateSelectedAgent(props);
          return {mutate, queryClient};
        },
        {
          initialProps: {project},
          organization,
        }
      );
    }

    it('sends correct API requests when integration is "seer"', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate('seer', {});
      });

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledTimes(1);
      });
      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {autofixAutomationTuning: 'medium'},
        })
      );

      expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            repositories: [],
            automated_run_stopping_point: 'code_changes',
            automation_handoff: undefined,
          }),
        })
      );
    });

    it('sends correct API requests when integration is "none"', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate('none', {});
      });

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledTimes(1);
      });
      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {autofixAutomationTuning: 'off'},
        })
      );

      expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            repositories: [],
            automated_run_stopping_point: 'code_changes',
            automation_handoff: undefined,
          }),
        })
      );
    });

    it('sends correct API requests when integration is a CodingAgentIntegration', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();
      const integration: CodingAgentIntegration = {
        id: '123',
        name: 'Cursor',
        provider: 'cursor',
      };

      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate(integration, {});
      });

      await waitFor(() => {
        expect(projectPutRequest).toHaveBeenCalledTimes(1);
      });
      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {autofixAutomationTuning: 'medium'},
        })
      );

      expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            repositories: [],
            automated_run_stopping_point: 'code_changes',
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 123,
              auto_create_pr: false,
            },
          }),
        })
      );
    });

    it('sets auto_create_pr from preference when integration is CodingAgentIntegration and stopping point is open_pr', async () => {
      const {seerPreferencesPostRequest} = setupMocks({
        ...basePreference,
        automated_run_stopping_point: 'open_pr',
      });
      const integration: CodingAgentIntegration = {
        id: '456',
        name: 'Cursor',
        provider: 'cursor',
      };

      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate(integration, {});
      });

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      });
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: expect.objectContaining({
              integration_id: 456,
              auto_create_pr: true,
            }),
          }),
        })
      );
    });

    it('passes through preference repositories and automated_run_stopping_point for all integration types', async () => {
      const preferenceWithRepos: ProjectSeerPreferences = {
        repositories: [
          {
            external_id: 'repo-1',
            name: 'my-repo',
            owner: 'my-org',
            provider: 'github',
          },
        ],
        automated_run_stopping_point: 'open_pr',
        automation_handoff: undefined,
      };

      const {seerPreferencesPostRequest} = setupMocks(preferenceWithRepos);
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate('seer', {});
      });

      await waitFor(() => {
        expect(seerPreferencesPostRequest).toHaveBeenCalledTimes(1);
      });
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            repositories: [
              {
                external_id: 'repo-1',
                name: 'my-repo',
                owner: 'my-org',
                provider: 'github',
              },
            ],
            automated_run_stopping_point: 'open_pr',
          }),
        })
      );
    });

    it('calls onSuccess when both requests succeed', async () => {
      setupMocks();
      const onSuccess = jest.fn();

      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate('seer', {onSuccess});
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onError when a request fails', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: basePreference,
          code_mapping_repos: [],
        } satisfies SeerPreferencesResponse,
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        statusCode: 500,
        body: {},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        body: {},
      });
      const onError = jest.fn();

      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate('seer', {onError});
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('optimistically updates the infinite query cache when selecting "seer"', () => {
      setupMocks();
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.queryClient.setQueryData(queryKey, makeInitialCacheData());
      });

      act(() => {
        result.current.mutate('seer', {});
      });

      const cached = result.current.queryClient.getQueryData(queryKey)!;
      expect(cached.pages[0]!.json[0]).toMatchObject({
        projectId: '1',
        autofixAutomationTuning: 'medium',
        automationHandoff: undefined,
      });
      // Other project should not be affected
      expect(cached.pages[0]!.json[1]).toMatchObject({
        projectId: '2',
        autofixAutomationTuning: 'medium',
      });
    });

    it('optimistically updates the infinite query cache when selecting "none"', () => {
      setupMocks();
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.queryClient.setQueryData(queryKey, makeInitialCacheData());
      });

      act(() => {
        result.current.mutate('none', {});
      });

      const cached = result.current.queryClient.getQueryData(queryKey)!;
      expect(cached.pages[0]!.json[0]).toMatchObject({
        projectId: '1',
        autofixAutomationTuning: 'off',
        automationHandoff: undefined,
      });
    });

    it('optimistically updates the infinite query cache when selecting a CodingAgentIntegration', async () => {
      setupMocks();
      const integration: CodingAgentIntegration = {
        id: '123',
        name: 'Cursor',
        provider: 'cursor',
      };
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.queryClient.setQueryData(queryKey, makeInitialCacheData());
      });

      act(() => {
        result.current.mutate(integration, {});
      });

      await waitFor(() => {
        const cached = result.current.queryClient.getQueryData(queryKey)!;
        expect(cached.pages[0]!.json[0]).toMatchObject({
          projectId: '1',
          autofixAutomationTuning: 'medium',
          automationHandoff: {
            handoff_point: 'root_cause',
            target: 'cursor_background_agent',
            integration_id: 123,
            auto_create_pr: false,
          },
        });
      });
    });

    it('updates ProjectsStore when selecting "seer"', () => {
      setupMocks();
      const storeSpy = jest.spyOn(ProjectsStore, 'onUpdateSuccess');
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate('seer', {});
      });

      expect(storeSpy).toHaveBeenCalledWith({
        id: '1',
        autofixAutomationTuning: 'medium',
      });
    });

    it('updates ProjectsStore when selecting "none"', () => {
      setupMocks();
      const storeSpy = jest.spyOn(ProjectsStore, 'onUpdateSuccess');
      const {result} = renderMutateSelectedAgent();

      act(() => {
        result.current.mutate('none', {});
      });

      expect(storeSpy).toHaveBeenCalledWith({
        id: '1',
        autofixAutomationTuning: 'off',
      });
    });
  });
});
