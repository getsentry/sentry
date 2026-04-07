import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {AutofixAutomationSettings} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {
  AutofixOverviewSection,
  useAutofixOverviewData,
} from 'sentry/views/settings/seer/overview/autofixOverviewSection';

function makeSettings(
  overrides: Partial<AutofixAutomationSettings> = {}
): AutofixAutomationSettings {
  return {
    projectId: '1',
    autofixAutomationTuning: 'medium',
    automatedRunStoppingPoint: 'code_changes',
    automationHandoff: undefined,
    reposCount: 0,
    ...overrides,
  };
}

describe('autofixOverviewSection', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  describe('useAutofixOverviewData', () => {
    function setupSettingsMock(settings: AutofixAutomationSettings[]) {
      return MockApiClient.addMockResponse({
        url: `/organizations/org-slug/autofix/automation-settings/`,
        method: 'GET',
        body: settings,
      });
    }

    describe('projectsWithRepos', () => {
      it('returns empty when there are no settings', async () => {
        const organization = OrganizationFixture();
        setupSettingsMock([]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithRepos).toHaveLength(0);
      });

      it('returns projects where reposCount > 0', async () => {
        const organization = OrganizationFixture();
        setupSettingsMock([
          makeSettings({projectId: '1', reposCount: 2}),
          makeSettings({projectId: '2', reposCount: 0}),
          makeSettings({projectId: '3', reposCount: 1}),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithRepos).toHaveLength(2);
      });

      it('returns no projects when all have reposCount === 0', async () => {
        const organization = OrganizationFixture();
        setupSettingsMock([
          makeSettings({projectId: '1', reposCount: 0}),
          makeSettings({projectId: '2', reposCount: 0}),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithRepos).toHaveLength(0);
      });
    });

    describe('projectsWithPreferredAgent — defaultCodingAgent is seer', () => {
      it('returns empty when there are no settings', async () => {
        const organization = OrganizationFixture({defaultCodingAgent: 'seer'});
        setupSettingsMock([]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithPreferredAgent).toHaveLength(0);
      });

      it('counts projects without automationHandoff when defaultCodingAgent is seer', async () => {
        const organization = OrganizationFixture({defaultCodingAgent: 'seer'});
        setupSettingsMock([
          makeSettings({projectId: '1', automationHandoff: undefined}),
          makeSettings({projectId: '2', automationHandoff: undefined}),
          makeSettings({
            projectId: '3',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
            },
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithPreferredAgent).toHaveLength(2);
      });

      it('returns none when all projects have automationHandoff', async () => {
        const organization = OrganizationFixture({defaultCodingAgent: 'seer'});
        setupSettingsMock([
          makeSettings({
            projectId: '1',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
            },
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithPreferredAgent).toHaveLength(0);
      });
    });

    describe('projectsWithPreferredAgent — defaultCodingAgent is an integration', () => {
      it('counts projects where automationHandoff.integration_id matches org setting', async () => {
        const organization = OrganizationFixture({
          defaultCodingAgent: 'cursor',
          defaultCodingAgentIntegrationId: 42,
        });
        setupSettingsMock([
          makeSettings({
            projectId: '1',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
            },
          }),
          makeSettings({
            projectId: '2',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 99,
            },
          }),
          makeSettings({projectId: '3', automationHandoff: undefined}),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithPreferredAgent).toHaveLength(1);
      });

      it('returns none when no integration_id matches', async () => {
        const organization = OrganizationFixture({
          defaultCodingAgent: 'cursor',
          defaultCodingAgentIntegrationId: 42,
        });
        setupSettingsMock([
          makeSettings({projectId: '1', automationHandoff: undefined}),
          makeSettings({
            projectId: '2',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 99,
            },
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithPreferredAgent).toHaveLength(0);
      });

      it('matches integration_id numerically despite string/number coercion', async () => {
        const organization = OrganizationFixture({
          defaultCodingAgent: 'cursor',
          defaultCodingAgentIntegrationId: 42,
        });
        setupSettingsMock([
          makeSettings({
            projectId: '1',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
            },
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithPreferredAgent).toHaveLength(1);
      });
    });

    describe('projectsWithCreatePr — autoOpenPrs is true', () => {
      it('counts projects with automationHandoff === null and open_pr stopping point', async () => {
        const organization = OrganizationFixture({autoOpenPrs: true});
        setupSettingsMock([
          // null (not undefined) is what the API actually returns; the source checks === null
          makeSettings({
            projectId: '1',
            automationHandoff: null as any,
            automatedRunStoppingPoint: 'open_pr',
          }),
          makeSettings({
            projectId: '2',
            automationHandoff: null as any,
            automatedRunStoppingPoint: 'code_changes', // null but not open_pr — no match
          }),
          makeSettings({
            projectId: '3',
            automationHandoff: undefined,
            automatedRunStoppingPoint: 'open_pr', // open_pr but undefined (not null) — no match
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        // Only project 1: automationHandoff is null AND stopping point is open_pr
        expect(result.current.data?.projectsWithCreatePr).toHaveLength(1);
      });

      it('counts projects with automationHandoff.auto_create_pr === true', async () => {
        const organization = OrganizationFixture({autoOpenPrs: true});
        setupSettingsMock([
          makeSettings({
            projectId: '1',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
              auto_create_pr: true,
            },
          }),
          makeSettings({
            projectId: '2',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
              auto_create_pr: false,
            },
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithCreatePr).toHaveLength(1);
      });

      it('counts both null-handoff-with-open_pr and handoff-with-auto_create_pr', async () => {
        const organization = OrganizationFixture({autoOpenPrs: true});
        setupSettingsMock([
          makeSettings({
            projectId: '1',
            automationHandoff: null as any, // null (not undefined) matches the === null check
            automatedRunStoppingPoint: 'open_pr',
          }),
          makeSettings({
            projectId: '2',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
              auto_create_pr: true,
            },
          }),
          makeSettings({
            projectId: '3',
            automationHandoff: undefined,
            automatedRunStoppingPoint: 'code_changes',
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithCreatePr).toHaveLength(2);
      });
    });

    describe('projectsWithCreatePr — autoOpenPrs is false', () => {
      it('counts projects not configured to create PRs', async () => {
        const organization = OrganizationFixture({autoOpenPrs: false});
        setupSettingsMock([
          makeSettings({
            projectId: '1',
            automationHandoff: undefined,
            automatedRunStoppingPoint: 'code_changes',
          }),
          makeSettings({
            projectId: '2',
            automationHandoff: undefined,
            automatedRunStoppingPoint: 'open_pr',
          }),
          makeSettings({
            projectId: '3',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
              auto_create_pr: true,
            },
          }),
          makeSettings({
            projectId: '4',
            automationHandoff: {
              handoff_point: 'root_cause',
              target: 'cursor_background_agent' as any,
              integration_id: 42,
              auto_create_pr: false,
            },
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        // project 1: no open_pr stopping point AND no auto_create_pr
        // project 4: no auto_create_pr (but integration exists)
        expect(result.current.data?.projectsWithCreatePr).toHaveLength(2);
      });

      it('returns all projects when none are configured to create PRs', async () => {
        const organization = OrganizationFixture({autoOpenPrs: false});
        setupSettingsMock([
          makeSettings({
            projectId: '1',
            automationHandoff: undefined,
            automatedRunStoppingPoint: 'code_changes',
          }),
          makeSettings({
            projectId: '2',
            automationHandoff: undefined,
            automatedRunStoppingPoint: 'solution',
          }),
        ]);

        const {result} = renderHookWithProviders(useAutofixOverviewData, {organization});

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current.data?.projectsWithCreatePr).toHaveLength(2);
      });
    });
  });

  describe('AutofixOverviewSection', () => {
    const organization = OrganizationFixture({defaultCodingAgent: 'seer'});

    function setupIntegrationsMock(
      integrations: Array<{id: string; name: string; provider: string}> = []
    ) {
      return MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/coding-agents/`,
        method: 'GET',
        body: {integrations},
      });
    }

    function renderSection(
      projectsWithPreferredAgent: AutofixAutomationSettings[],
      {
        projects = [ProjectFixture()],
        org = organization,
        projectsWithCreatePr = [] as AutofixAutomationSettings[],
      } = {}
    ) {
      ProjectsStore.loadInitialData(projects);

      const data = {
        projectsWithRepos: [],
        projectsWithPreferredAgent,
        projectsWithCreatePr,
      } as any;

      return render(
        <AutofixOverviewSection
          canWrite
          organization={org}
          data={data}
          isPending={false}
          // satisfy remaining required react-query fields
          {...({} as any)}
        />,
        {organization: org}
      );
    }

    describe('AgentNameForm labels', () => {
      beforeEach(() => {
        setupIntegrationsMock();
      });

      it('shows "No projects found" when there are no projects', async () => {
        renderSection([], {projects: []});

        // Each form section renders this text; AgentNameForm only shows it after
        // the integrations query resolves, so use waitFor to retry until both appear
        await waitFor(() => {
          expect(screen.getAllByText('No projects found').length).toBeGreaterThanOrEqual(
            2
          );
        });
      });

      it('shows "Your existing project uses Seer Agent" when 1 project uses preferred agent', async () => {
        renderSection([makeSettings({projectId: '1'})], {
          projects: [ProjectFixture({id: '1'})],
        });

        expect(
          await screen.findByText('Your existing project uses Seer Agent')
        ).toBeInTheDocument();
      });

      it('shows "Your existing project does not use Seer Agent" when 1 project does not use preferred agent', async () => {
        renderSection([], {projects: [ProjectFixture({id: '1'})]});

        expect(
          await screen.findByText('Your existing project does not use Seer Agent')
        ).toBeInTheDocument();
      });

      it('shows "All existing projects use Seer Agent" when all projects match', async () => {
        const projects = [
          ProjectFixture({id: '1'}),
          ProjectFixture({id: '2'}),
          ProjectFixture({id: '3'}),
        ];
        renderSection(
          [
            makeSettings({projectId: '1'}),
            makeSettings({projectId: '2'}),
            makeSettings({projectId: '3'}),
          ],
          {projects}
        );

        expect(
          await screen.findByText('All existing projects use Seer Agent')
        ).toBeInTheDocument();
      });

      it('shows "{count} of {total} existing projects use {label}" when some match', async () => {
        const projects = [
          ProjectFixture({id: '1'}),
          ProjectFixture({id: '2'}),
          ProjectFixture({id: '3'}),
        ];
        renderSection([makeSettings({projectId: '1'})], {projects});

        expect(
          await screen.findByText('1 of 3 existing projects use Seer Agent')
        ).toBeInTheDocument();
      });

      it('shows correct label when the preferred agent is a named integration', async () => {
        setupIntegrationsMock([{id: '42', name: 'Cursor', provider: 'cursor'}]);
        const org = OrganizationFixture({
          defaultCodingAgent: 'cursor',
          defaultCodingAgentIntegrationId: 42,
        });
        renderSection([makeSettings({projectId: '1'})], {
          projects: [ProjectFixture({id: '1'})],
          org,
        });

        expect(
          await screen.findByText('Your existing project uses Cursor')
        ).toBeInTheDocument();
      });
    });

    describe('codingAgentMutationOpts', () => {
      it('sends PUT with defaultCodingAgent=seer when seer is selected', async () => {
        const org = OrganizationFixture({
          defaultCodingAgent: 'cursor',
          defaultCodingAgentIntegrationId: 42,
        });
        setupIntegrationsMock([{id: '42', name: 'Cursor', provider: 'cursor'}]);

        const orgPutRequest = MockApiClient.addMockResponse({
          url: `/organizations/${org.slug}/`,
          method: 'PUT',
          body: OrganizationFixture(),
        });

        renderSection([], {org});

        // Open the select dropdown
        await userEvent.click(
          await screen.findByRole('textbox', {name: /default preferred coding agent/i})
        );

        // Choose Seer Agent
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Seer Agent'}));

        await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
        expect(orgPutRequest).toHaveBeenCalledWith(
          `/organizations/${org.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              defaultCodingAgent: 'seer',
              defaultCodingAgentIntegrationId: null,
            },
          })
        );
      });

      it('sends PUT with integration provider and id when an integration is selected', async () => {
        const org = OrganizationFixture({
          defaultCodingAgent: 'seer',
          defaultCodingAgentIntegrationId: null,
        });
        setupIntegrationsMock([{id: '42', name: 'Cursor', provider: 'cursor'}]);

        const orgPutRequest = MockApiClient.addMockResponse({
          url: `/organizations/${org.slug}/`,
          method: 'PUT',
          body: OrganizationFixture(),
        });

        renderSection([], {org});

        // Open the select dropdown
        await userEvent.click(
          await screen.findByRole('textbox', {name: /default preferred coding agent/i})
        );

        // Choose the Cursor integration
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Cursor'}));

        await waitFor(() => expect(orgPutRequest).toHaveBeenCalledTimes(1));
        expect(orgPutRequest).toHaveBeenCalledWith(
          `/organizations/${org.slug}/`,
          expect.objectContaining({
            method: 'PUT',
            data: {
              defaultCodingAgent: 'cursor',
              defaultCodingAgentIntegrationId: '42',
            },
          })
        );
      });
    });
  });
});
