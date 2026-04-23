import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import type {SeerPreferencesResponse} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useBulkMutateSelectedAgent} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

describe('seerPreferredAgent', () => {
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

  describe('useBulkMutateSelectedAgent', () => {
    const preference: SeerPreferencesResponse['preference'] = {
      repositories: [],
      automated_run_stopping_point: 'code_changes',
      automation_handoff: undefined,
    };

    function setupMocks(
      preferenceOverride: SeerPreferencesResponse['preference'] = preference
    ) {
      const seerPreferencesGetRequest = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {
          preference: preferenceOverride,
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

    it('sets autofixAutomationTuning to "medium" and clears handoff when integration is "seer"', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();

      const {result} = renderHookWithProviders(useBulkMutateSelectedAgent, {
        organization,
      });

      await act(async () => {
        await result.current([project], 'seer');
      });

      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          data: {autofixAutomationTuning: 'medium'},
        })
      );
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: undefined,
          }),
        })
      );
    });

    it('sets handoff payload when integration is a CodingAgentIntegration', async () => {
      const {projectPutRequest, seerPreferencesPostRequest} = setupMocks();
      const integration: CodingAgentIntegration = {
        id: '42',
        name: 'Cursor',
        provider: 'cursor',
      };

      const {result} = renderHookWithProviders(useBulkMutateSelectedAgent, {
        organization,
      });

      await act(async () => {
        await result.current([project], integration);
      });

      expect(projectPutRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/`,
        expect.objectContaining({
          data: {autofixAutomationTuning: 'medium'},
        })
      );
      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: expect.objectContaining({
              handoff_point: 'root_cause',
              integration_id: 42,
            }),
          }),
        })
      );
    });

    it('sets auto_create_pr true when automated_run_stopping_point is "open_pr"', async () => {
      const {seerPreferencesPostRequest} = setupMocks({
        repositories: [],
        automated_run_stopping_point: 'open_pr',
        automation_handoff: undefined,
      });
      const integration: CodingAgentIntegration = {
        id: '42',
        name: 'Cursor',
        provider: 'cursor',
      };

      const {result} = renderHookWithProviders(useBulkMutateSelectedAgent, {
        organization,
      });
      await act(async () => {
        await result.current([project], integration);
      });

      expect(seerPreferencesPostRequest).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        expect.objectContaining({
          data: expect.objectContaining({
            automation_handoff: expect.objectContaining({
              auto_create_pr: true,
            }),
          }),
        })
      );
    });

    it('updates ProjectsStore on success', async () => {
      setupMocks();
      const updateSuccessSpy = jest.spyOn(ProjectsStore, 'onUpdateSuccess');

      const {result} = renderHookWithProviders(useBulkMutateSelectedAgent, {
        organization,
      });

      await act(async () => {
        await result.current([project], 'seer');
      });

      expect(updateSuccessSpy).toHaveBeenCalledWith({
        id: project.id,
        autofixAutomationTuning: 'medium',
      });
    });

    it('shows a generic error message when requests fail with non-429 errors', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {preference, code_mapping_repos: []},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        statusCode: 500,
        body: {detail: 'Internal Server Error'},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        statusCode: 500,
        body: {detail: 'Internal Server Error'},
      });
      const addErrorMessageSpy = jest.spyOn(indicators, 'addErrorMessage');

      const {result} = renderHookWithProviders(useBulkMutateSelectedAgent, {
        organization,
      });

      await act(async () => {
        await result.current([project], 'seer');
      });

      expect(addErrorMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update settings')
      );
    });

    it('shows a rate-limit error message when requests fail with 429', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'GET',
        body: {preference, code_mapping_repos: []},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/`,
        method: 'PUT',
        statusCode: 429,
        body: {detail: 'Too Many Requests'},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
        method: 'POST',
        statusCode: 429,
        body: {detail: 'Too Many Requests'},
      });
      const addErrorMessageSpy = jest.spyOn(indicators, 'addErrorMessage');

      const {result} = renderHookWithProviders(useBulkMutateSelectedAgent, {
        organization,
      });

      await act(async () => {
        await result.current([project], 'seer');
      });

      expect(addErrorMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('Too many requests')
      );
    });
  });
});
