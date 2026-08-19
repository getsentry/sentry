import type {InfiniteData} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';
import {
  AutofixSettingsPartialSaveError,
  upsertSettingsRowSorted,
  useMutateAutofixProject,
} from 'sentry/utils/seer/useMutateAutofixProject';

describe('useMutateAutofixProject', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('writes repos via seer/repos and project settings via seer/settings', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {integrations: []},
    });
    const reposPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'PUT',
      status: 204,
    });
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
      status: 204,
    });
    const prefsPost = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/preferences/`,
      method: 'POST',
      status: 204,
    });

    const {result} = renderHookWithProviders(useMutateAutofixProject, {organization});

    result.current.mutate({
      project,
      repoEntries: [{repoId: '7', branch: 'main'}],
      agentOption: 'seer',
      stoppingPoint: 'root_cause',
    });

    await waitFor(() => expect(reposPut).toHaveBeenCalled());
    expect(reposPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {repos: [{repositoryId: 7, branchName: 'main'}]}})
    );

    await waitFor(() => expect(settingsPut).toHaveBeenCalled());
    expect(settingsPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          agent: 'seer',
          automationTuning: 'medium',
          stoppingPoint: 'root_cause',
        }),
      })
    );

    // The legacy preferences endpoint is GitLab-incompatible for nested groups,
    // so the modal save path should avoid it.
    expect(prefsPost).not.toHaveBeenCalled();
  });

  it('writes repos before settings and throws a partial-save error when settings fail', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      method: 'GET',
      body: {integrations: []},
    });
    const reposPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      method: 'PUT',
      status: 204,
    });
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
      statusCode: 500,
      body: {detail: 'boom'},
    });

    const {result} = renderHookWithProviders(useMutateAutofixProject, {organization});

    await expect(
      result.current.mutateAsync({
        project,
        repoEntries: [{repoId: '7', branch: 'main'}],
        agentOption: 'seer',
        stoppingPoint: 'root_cause',
      })
    ).rejects.toBeInstanceOf(AutofixSettingsPartialSaveError);

    // Repos are the higher-priority write and must be persisted first, so they
    // survive even when the settings write fails.
    expect(reposPut).toHaveBeenCalled();
    expect(settingsPut).toHaveBeenCalled();
  });

  describe('upsertSettingsRowSorted', () => {
    function makeRow(
      overrides: Partial<SeerProjectSettingResponse>
    ): SeerProjectSettingResponse {
      return {
        projectId: '1',
        projectSlug: 'a-project',
        agent: 'seer',
        integrationId: null,
        stoppingPoint: 'root_cause',
        autoCreatePr: null,
        automationTuning: 'medium',
        scannerAutomation: false,
        reposCount: 1,
        ...overrides,
      };
    }

    function makeData(
      ...pages: SeerProjectSettingResponse[][]
    ): InfiniteData<ApiResponse<SeerProjectSettingResponse[]>> {
      return {
        pages: pages.map(json => ({headers: {}, json})),
        pageParams: pages.map((_, index) => index),
      };
    }

    function slugs(data: InfiniteData<ApiResponse<SeerProjectSettingResponse[]>>) {
      return data.pages.map(page => page.json.map(item => item.projectSlug));
    }

    it('inserts by slug for the name sort', () => {
      const data = makeData([
        makeRow({projectId: '1', projectSlug: 'a-project'}),
        makeRow({projectId: '2', projectSlug: 'z-project'}),
      ]);
      const row = makeRow({projectId: '3', projectSlug: 'm-project'});

      expect(slugs(upsertSettingsRowSorted(data, row, 'name'))).toEqual([
        ['a-project', 'm-project', 'z-project'],
      ]);

      // A descending cache holds the same list in reverse order.
      const descendingData = makeData([
        makeRow({projectId: '2', projectSlug: 'z-project'}),
        makeRow({projectId: '1', projectSlug: 'a-project'}),
      ]);
      expect(slugs(upsertSettingsRowSorted(descendingData, row, '-name'))).toEqual([
        ['z-project', 'm-project', 'a-project'],
      ]);
    });

    it('ranks No Automation before every stopping point', () => {
      const data = makeData([
        makeRow({projectId: '1', projectSlug: 'first', stoppingPoint: 'root_cause'}),
        makeRow({projectId: '2', projectSlug: 'second', stoppingPoint: 'open_pr'}),
      ]);
      const row = makeRow({
        projectId: '3',
        projectSlug: 'off-project',
        automationTuning: 'off',
      });

      expect(slugs(upsertSettingsRowSorted(data, row, 'stoppingPoint'))).toEqual([
        ['off-project', 'first', 'second'],
      ]);
    });

    it('inserts into the page whose range contains the row', () => {
      const data = makeData(
        [
          makeRow({projectId: '1', projectSlug: 'a-project'}),
          makeRow({projectId: '2', projectSlug: 'c-project'}),
        ],
        [
          makeRow({projectId: '3', projectSlug: 'e-project'}),
          makeRow({projectId: '4', projectSlug: 'g-project'}),
        ]
      );
      const row = makeRow({projectId: '5', projectSlug: 'f-project'});

      expect(slugs(upsertSettingsRowSorted(data, row, 'name'))).toEqual([
        ['a-project', 'c-project'],
        ['e-project', 'f-project', 'g-project'],
      ]);
    });

    it('updates an existing row in place without moving it', () => {
      const data = makeData([
        makeRow({projectId: '1', projectSlug: 'a-project', agent: 'seer'}),
        makeRow({projectId: '2', projectSlug: 'z-project'}),
      ]);
      const row = makeRow({
        projectId: '1',
        projectSlug: 'a-project',
        agent: CodingAgentProvider.CURSOR_BACKGROUND_AGENT,
      });

      const result = upsertSettingsRowSorted(data, row, '-name');
      expect(slugs(result)).toEqual([['a-project', 'z-project']]);
      expect(result.pages[0]!.json[0]!.agent).toBe(
        CodingAgentProvider.CURSOR_BACKGROUND_AGENT
      );
    });
  });
});
