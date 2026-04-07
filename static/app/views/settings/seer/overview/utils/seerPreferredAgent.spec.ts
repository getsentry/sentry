import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import type {SeerPreferencesResponse} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useMutation} from 'sentry/utils/queryClient';
import {
  useBulkMutateSelectedAgent,
  useFetchPreferredAgent,
  useFetchAgentOptions,
  getPreferredAgentMutationOptions,
} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

describe('seerPreferredAgent', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});
  const project = ProjectFixture({slug: 'project-slug', id: '1'});

  const integrations: CodingAgentIntegration[] = [
    {id: '42', name: 'Cursor', provider: 'cursor'},
    {id: '99', name: 'Claude Code', provider: 'claude_code'},
  ];

  function mockIntegrationsEndpoint(
    body: {integrations: CodingAgentIntegration[]} = {integrations}
  ) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body,
    });
  }

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
    ProjectsStore.reset();
  });

  describe('useFetchPreferredAgent', () => {
    it('returns "seer" when no defaultCodingAgent or defaultCodingAgentIntegrationId', () => {
      mockIntegrationsEndpoint();
      const org = OrganizationFixture({
        slug: 'org-slug',
        defaultCodingAgent: null,
        defaultCodingAgentIntegrationId: null,
      });

      const {result} = renderHookWithProviders(useFetchPreferredAgent, {
        initialProps: {organization: org},
      });

      expect(result.current.data).toBe('seer');
    });

    it('uses defaultCodingAgentIntegrationId when set', async () => {
      mockIntegrationsEndpoint();
      const org = OrganizationFixture({
        slug: 'org-slug',
        defaultCodingAgentIntegrationId: 42,
        defaultCodingAgent: null,
      });

      const {result} = renderHookWithProviders(useFetchPreferredAgent, {
        initialProps: {organization: org},
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toMatchObject({id: '42', name: 'Cursor'});
    });

    it('falls back to defaultCodingAgent when no defaultCodingAgentIntegrationId', async () => {
      mockIntegrationsEndpoint();
      const org = OrganizationFixture({
        slug: 'org-slug',
        defaultCodingAgent: 'claude_code',
        defaultCodingAgentIntegrationId: null,
      });

      const {result} = renderHookWithProviders(useFetchPreferredAgent, {
        initialProps: {organization: org},
      });

      // 'claude_code' won't match any integration id (ids are '42', '99'), so returns 'seer'
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe('seer');
    });

    it('returns matching integration when defaultCodingAgent matches integration id', async () => {
      mockIntegrationsEndpoint({
        integrations: [{id: 'cursor', name: 'Cursor', provider: 'cursor'}],
      });
      const org = OrganizationFixture({
        slug: 'org-slug',
        defaultCodingAgent: 'cursor',
        defaultCodingAgentIntegrationId: null,
      });

      const {result} = renderHookWithProviders(useFetchPreferredAgent, {
        initialProps: {organization: org},
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toMatchObject({id: 'cursor', name: 'Cursor'});
    });

    it('returns "seer" when no integration matches the value', async () => {
      mockIntegrationsEndpoint({integrations: []});
      const org = OrganizationFixture({
        slug: 'org-slug',
        defaultCodingAgent: 'nonexistent',
        defaultCodingAgentIntegrationId: null,
      });

      const {result} = renderHookWithProviders(useFetchPreferredAgent, {
        initialProps: {organization: org},
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe('seer');
    });
  });

  describe('useFetchPreferredAgentOptions', () => {
    it('includes "seer" as first option plus integration options', async () => {
      mockIntegrationsEndpoint();

      const {result} = renderHookWithProviders(useFetchAgentOptions, {
        initialProps: {organization},
        organization,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const options = result.current.data!;
      expect(options).toHaveLength(3);
      expect(options[0]).toEqual({value: 'seer', label: expect.any(String)});
      expect(options[1]).toMatchObject({
        value: {id: '42', name: 'Cursor'},
        label: 'Cursor',
      });
      expect(options[2]).toMatchObject({
        value: {id: '99', name: 'Claude Code'},
        label: 'Claude Code',
      });
    });

    it('filters out integrations without an id', async () => {
      mockIntegrationsEndpoint({
        integrations: [
          {id: null, name: 'No Id', provider: 'other'},
          {id: '1', name: 'With Id', provider: 'cursor'},
        ],
      });

      const {result} = renderHookWithProviders(useFetchAgentOptions, {
        initialProps: {organization},
        organization,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const options = result.current.data!;
      expect(options).toHaveLength(2); // seer + one integration
      expect(options[1]).toMatchObject({
        value: {id: '1', name: 'With Id'},
        label: 'With Id',
      });
    });

    it('returns only "seer" when there are no integrations', async () => {
      mockIntegrationsEndpoint({integrations: []});

      const {result} = renderHookWithProviders(useFetchAgentOptions, {
        initialProps: {organization},
        organization,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0]).toEqual({value: 'seer', label: expect.any(String)});
    });
  });

  describe('usePreferredAgentMutationOptions', () => {
    function mockOrgPutRequest() {
      return MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/`,
        method: 'PUT',
        body: OrganizationFixture({slug: organization.slug}),
      });
    }

    beforeEach(() => {
      OrganizationsStore.addOrReplace(organization);
    });

    it('sends PUT with seer payload when integration is "seer"', async () => {
      mockIntegrationsEndpoint();
      const orgPutRequest = mockOrgPutRequest();

      const options = getPreferredAgentMutationOptions({organization});
      const {result} = renderHookWithProviders(useMutation, {
        initialProps: options,
      });

      act(() => {
        result.current.mutateAsync({integration: 'seer'});
      });

      await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
      expect(orgPutRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            defaultCodingAgent: 'seer',
            defaultCodingAgentIntegrationId: null,
          },
        })
      );
    });

    it('sends PUT with integration payload when integration is a CodingAgentIntegration', async () => {
      mockIntegrationsEndpoint();
      const orgPutRequest = mockOrgPutRequest();
      const integration: CodingAgentIntegration = {
        id: '42',
        name: 'Cursor',
        provider: 'cursor',
      };

      const options = getPreferredAgentMutationOptions({organization});
      const {result} = renderHookWithProviders(useMutation, {
        initialProps: options,
      });

      act(() => {
        result.current.mutateAsync({integration});
      });

      await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
      expect(orgPutRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/`,
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            defaultCodingAgent: 'cursor',
            defaultCodingAgentIntegrationId: '42',
          }),
        })
      );
    });
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
