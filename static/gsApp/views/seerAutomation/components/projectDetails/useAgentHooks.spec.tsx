import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import ProjectsStore from 'sentry/stores/projectsStore';

import {
  useAgentOptions,
  useMutateSelectedAgent,
  useSelectedAgent,
} from 'getsentry/views/seerAutomation/components/projectDetails/useAgentHooks';

describe('useAgentHooks', () => {
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

  describe('useAgentOptions', () => {
    it('returns Seer, integration options, and Manual Agent Selection', () => {
      const integrations: CodingAgentIntegration[] = [
        {id: '42', name: 'Cursor', provider: 'cursor'},
      ];

      const {result} = renderHookWithProviders(useAgentOptions, {
        initialProps: {integrations},
        organization,
      });

      const options = result.current;
      expect(options).toHaveLength(3);
      expect(options[0]).toEqual({value: 'seer', label: expect.any(String)});
      expect(options[1]).toMatchObject({
        value: {id: '42', name: 'Cursor', provider: 'cursor'},
        label: 'Cursor (42)',
      });
      expect(options[2]).toEqual({value: 'none', label: expect.any(String)});
    });

    it('filters out integrations without id', () => {
      const integrations: CodingAgentIntegration[] = [
        {id: null, name: 'No Id', provider: 'other'},
        {id: '1', name: 'With Id', provider: 'cursor'},
      ];

      const {result} = renderHookWithProviders(useAgentOptions, {
        initialProps: {integrations},
        organization,
      });

      const options = result.current;
      expect(options).toHaveLength(3);
      expect(options[1]!.value).toMatchObject({id: '1', name: 'With Id'});
    });
  });

  describe('useSelectedAgent', () => {
    it('returns "none" when project autofixAutomationTuning is off', () => {
      const p = ProjectFixture({...project, autofixAutomationTuning: 'off'});

      const {result} = renderHookWithProviders(useSelectedAgent, {
        initialProps: {
          preference: {repositories: []},
          project: p,
          integrations: [],
        },
        organization,
      });

      expect(result.current).toBe('none');
    });

    it('returns "seer" when no automation_handoff integration_id', () => {
      const {result} = renderHookWithProviders(useSelectedAgent, {
        initialProps: {
          preference: {repositories: []},
          project,
          integrations: [],
        },
        organization,
      });

      expect(result.current).toBe('seer');
    });

    it('returns matching integration when automation_handoff has integration_id', () => {
      const integrations: CodingAgentIntegration[] = [
        {id: '99', name: 'Cursor', provider: 'cursor'},
      ];

      const {result} = renderHookWithProviders(useSelectedAgent, {
        initialProps: {
          preference: {
            repositories: [],
            automation_handoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent',
              integration_id: 99,
            },
          },
          project,
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

    function setupMocks() {
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
      return {projectPutRequest, seerPreferencesPostRequest};
    }

    it('sends correct API requests when integration is "seer"', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();

      const {result} = renderHookWithProviders(useMutateSelectedAgent, {
        initialProps: {preference: basePreference, project},
        organization,
      });

      act(() => {
        result.current('seer', {});
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

      const {result} = renderHookWithProviders(useMutateSelectedAgent, {
        initialProps: {preference: basePreference, project},
        organization,
      });

      act(() => {
        result.current('none', {});
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

      const {result} = renderHookWithProviders(useMutateSelectedAgent, {
        initialProps: {preference: basePreference, project},
        organization,
      });

      act(() => {
        result.current(integration, {});
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
      const {seerPreferencesPostRequest} = setupMocks();
      const integration: CodingAgentIntegration = {
        id: '456',
        name: 'Cursor',
        provider: 'cursor',
      };
      const preferenceWithOpenPr: ProjectSeerPreferences = {
        ...basePreference,
        automated_run_stopping_point: 'open_pr',
      };

      const {result} = renderHookWithProviders(useMutateSelectedAgent, {
        initialProps: {preference: preferenceWithOpenPr, project},
        organization,
      });

      act(() => {
        result.current(integration, {});
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
      const {seerPreferencesPostRequest} = setupMocks();
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

      const {result} = renderHookWithProviders(useMutateSelectedAgent, {
        initialProps: {preference: preferenceWithRepos, project},
        organization,
      });

      act(() => {
        result.current('seer', {});
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

      const {result} = renderHookWithProviders(useMutateSelectedAgent, {
        initialProps: {preference: basePreference, project},
        organization,
      });

      act(() => {
        result.current('seer', {onSuccess});
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onError when a request fails', async () => {
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

      const {result} = renderHookWithProviders(useMutateSelectedAgent, {
        initialProps: {preference: basePreference, project},
        organization,
      });

      act(() => {
        result.current('seer', {onError});
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
