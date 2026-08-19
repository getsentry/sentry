import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {SentryNuqsTestingAdapter} from 'sentry-test/nuqsTestingAdapter';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {AutofixStoppingPoint} from 'sentry/components/events/autofix/types';
import {SeerProjectTable} from 'sentry/components/seer/projectTable/seerProjectTable';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';

const mockOpenModal = jest.fn();

jest.mock('@sentry/scraps/modal', () => ({
  ...jest.requireActual('@sentry/scraps/modal'),
  useModal: () => ({openModal: mockOpenModal}),
}));

// jsdom has no layout, so the virtualizer would render zero rows. Force it to
// render a row per item so the table body is present.
jest.mock('@tanstack/react-virtual', () => ({
  ...jest.requireActual('@tanstack/react-virtual'),
  useVirtualizer: ({count}: {count: number}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, index) => ({
        key: index,
        index,
        start: index * 41,
        end: (index + 1) * 41,
        size: 41,
        lane: 0,
      })),
    getTotalSize: () => count * 41,
    measure: () => {},
    measureElement: () => {},
  }),
}));

describe('SeerProjectTable', () => {
  let organization = OrganizationFixture();
  let project = ProjectFixture();
  let suggestedProject = ProjectFixture();

  function makeProjectSettings(overrides: Record<string, unknown> = {}) {
    return {
      projectId: project.id,
      projectSlug: project.slug,
      agent: 'seer',
      integrationId: null,
      stoppingPoint: 'root_cause',
      autoCreatePr: null,
      automationTuning: 'off',
      scannerAutomation: false,
      reposCount: 1,
      ...overrides,
    };
  }

  function makeSuggestion(overrides: Record<string, unknown> = {}) {
    return {
      projectId: suggestedProject.id,
      projectSlug: suggestedProject.slug,
      linkedReposCount: 1,
      linkedRepositories: [
        {
          repositoryId: '11',
          name: 'getsentry/suggested-repository',
          provider: 'integrations:github',
        },
      ],
      ...overrides,
    };
  }

  function mockBaseEndpoints({
    projectSettings = [makeProjectSettings()],
    codingAgents,
    codingAgentsDelay,
  }: {
    codingAgents?: () => unknown;
    codingAgentsDelay?: number;
    projectSettings?: unknown[];
  } = {}) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body:
        codingAgents ??
        (() => ({
          integrations: [{id: '123', provider: 'cursor', name: 'Cursor Cloud Agent'}],
        })),
      ...(codingAgentsDelay ? {asyncDelay: codingAgentsDelay} : {}),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      body: projectSettings,
    });
  }

  function mockSuggestions({
    body = [makeSuggestion()],
    headers,
    match,
    statusCode,
  }: {
    body?: unknown[] | (() => unknown[]);
    headers?: Record<string, string>;
    match?: Array<(url: string, options: Record<string, unknown>) => boolean>;
    statusCode?: number;
  } = {}) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/project-suggestions/`,
      body,
      ...(headers ? {headers} : {}),
      ...(match ? {match} : {}),
      ...(statusCode ? {statusCode} : {}),
    });
  }

  function makeRepo(provider: string, id: string) {
    return {
      id,
      repositoryId: id,
      branchName: '',
      branchOverrides: [],
      instructions: '',
      externalId: `10${id}`,
      integrationId: `20${id}`,
      name: 'sentry',
      organizationId: '',
      owner: 'getsentry',
      provider,
    };
  }

  function mockProjectRepos(provider: string) {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/repos/`,
      body: [makeRepo(provider, '1')],
    });
  }

  beforeEach(() => {
    organization = OrganizationFixture({access: ['org:write']});
    project = ProjectFixture({id: '2', slug: 'project-slug'});
    suggestedProject = ProjectFixture({
      id: '3',
      slug: 'suggested-project',
      name: 'Suggested Project',
    });
    ProjectsStore.loadInitialData([project, suggestedProject]);
    mockBaseEndpoints();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    mockOpenModal.mockReset();
    jest.restoreAllMocks();
  });

  function renderTable(search = '') {
    const query = Object.fromEntries(new URLSearchParams(search));
    render(
      <SentryNuqsTestingAdapter>
        <SeerProjectTable />
      </SentryNuqsTestingAdapter>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/settings/${organization.slug}/seer/projects/`,
            query,
          },
        },
      }
    );
  }

  function setupSuggestionTable({
    organizationOverrides,
    projectSettings = [makeProjectSettings()],
    suggestions = [makeSuggestion()],
    codingAgents,
    codingAgentsDelay,
    statusCode,
  }: {
    codingAgents?: () => unknown;
    codingAgentsDelay?: number;
    organizationOverrides?: Partial<Organization>;
    projectSettings?: unknown[];
    statusCode?: number;
    suggestions?: null | unknown[] | (() => unknown[]);
  } = {}) {
    organization = OrganizationFixture({
      access: ['org:write'],
      features: ['seer-autofix-quick-add'],
      defaultAutomatedRunStoppingPoint: AutofixStoppingPoint.ROOT_CAUSE,
      ...organizationOverrides,
    });
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project, suggestedProject]);
    mockBaseEndpoints({projectSettings, codingAgents, codingAgentsDelay});
    return suggestions === null
      ? undefined
      : mockSuggestions({body: suggestions, statusCode});
  }

  it('blocks coding-agent handoff and warns for a project with a non-GitHub repo', async () => {
    mockProjectRepos('gitlab');
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });
    const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

    renderTable();

    // The agent dropdown renders its current value, "Seer".
    await userEvent.click(await screen.findByText('Seer'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
    );

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Only the Seer agent is supported for non-GitHub repositories.'
      )
    );
    // The change is never committed or persisted.
    expect(settingsPut).not.toHaveBeenCalled();
    expect(screen.getByText('Seer')).toBeInTheDocument();
    expect(screen.queryByText('Cursor Cloud Agent')).not.toBeInTheDocument();
  });

  it('blocks handoff when a non-GitHub repo is only on a later page', async () => {
    const reposUrl = `/projects/${organization.slug}/${project.slug}/seer/repos/`;
    // Page 1 is all GitHub and points to a `next` page via the Link header.
    MockApiClient.addMockResponse({
      url: reposUrl,
      body: [makeRepo('github', '1')],
      headers: {
        Link: `<${reposUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });
    // Page 2 carries the GitLab repo and terminates pagination.
    MockApiClient.addMockResponse({
      url: reposUrl,
      body: [makeRepo('gitlab', '2')],
      headers: {
        Link: `<${reposUrl}?cursor=0:200:0>; rel="next"; results="false"; cursor="0:200:0"`,
      },
      match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
    });
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });
    const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

    renderTable();

    await userEvent.click(await screen.findByText('Seer'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
    );

    // The guard drains every page, so the second-page GitLab repo still blocks.
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        'Only the Seer agent is supported for non-GitHub repositories.'
      )
    );
    expect(settingsPut).not.toHaveBeenCalled();
    expect(screen.getByText('Seer')).toBeInTheDocument();
  });

  it('allows coding-agent handoff for a GitHub-only project', async () => {
    mockProjectRepos('github');
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });
    const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

    renderTable();

    await userEvent.click(await screen.findByText('Seer'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
    );

    // The check passes, so the selection is persisted and no warning is shown.
    await waitFor(() => expect(settingsPut).toHaveBeenCalled());
    expect(errorSpy).not.toHaveBeenCalled();
  });

  describe('suggested projects', () => {
    const disabledSuggestionCases: Array<[string, Partial<Organization>]> = [
      ['the feature is disabled', {features: []}],
      ['the user cannot write settings', {access: ['org:read']}],
    ];

    it.each(disabledSuggestionCases)(
      'does not request suggestions when %s',
      async (_label, organizationOverrides) => {
        const suggestionsRequest = setupSuggestionTable({
          organizationOverrides,
          projectSettings: [],
        });

        renderTable();

        expect(
          await screen.findByRole('heading', {name: 'Enable Autofix on a Project'})
        ).toBeInTheDocument();
        expect(suggestionsRequest).not.toHaveBeenCalled();
      }
    );

    it.each(['?name=project', '?agent=seer'])(
      'does not request or show suggestions with active filters: %s',
      async search => {
        const suggestionsRequest = setupSuggestionTable();

        renderTable(search);

        await screen.findByText(project.slug);
        expect(suggestionsRequest).not.toHaveBeenCalled();
        expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
      }
    );

    it('renders candidate metadata without requesting all organization repositories', async () => {
      setupSuggestionTable();
      const allRepositoriesRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/`,
        body: [],
      });

      renderTable();

      const suggestionRow = (
        await screen.findByText(suggestedProject.slug)
      ).closest<HTMLElement>('[role="row"]')!;
      expect(within(suggestionRow).getByText('Suggested')).toBeInTheDocument();
      // The row selects come preselected with the effective defaults.
      expect(await within(suggestionRow).findByText('Seer')).toBeInTheDocument();
      expect(
        within(suggestionRow).getByText('Stop after Root Cause')
      ).toBeInTheDocument();

      // The repo names live in the tooltip on the linked repository count.
      await userEvent.hover(within(suggestionRow).getByText('1'));
      expect(
        await screen.findByText('getsentry/suggested-repository')
      ).toBeInTheDocument();
      expect(allRepositoriesRequest).not.toHaveBeenCalled();
    });

    it('loads the next suggestion page only after Show more is selected', async () => {
      const secondSuggestedProject = ProjectFixture({
        id: '4',
        slug: 'second-suggested-project',
        name: 'Second Suggested Project',
      });
      setupSuggestionTable({suggestions: null});
      ProjectsStore.loadInitialData([project, suggestedProject, secondSuggestedProject]);
      const suggestionsUrl = `/organizations/${organization.slug}/seer/project-suggestions/`;
      const firstPageRequest = MockApiClient.addMockResponse({
        url: suggestionsUrl,
        body: [makeSuggestion()],
        headers: {
          Link: `<${suggestionsUrl}?cursor=0:10:0>; rel="next"; results="true"; cursor="0:10:0"`,
        },
      });
      const secondPageRequest = MockApiClient.addMockResponse({
        url: suggestionsUrl,
        body: [
          makeSuggestion({
            projectId: secondSuggestedProject.id,
            projectSlug: secondSuggestedProject.slug,
            linkedRepositories: [
              {
                repositoryId: '12',
                name: 'getsentry/second-repository',
                provider: 'integrations:github',
              },
            ],
          }),
        ],
        headers: {
          Link: `<${suggestionsUrl}?cursor=0:20:0>; rel="next"; results="false"; cursor="0:20:0"`,
        },
        match: [MockApiClient.matchQuery({cursor: '0:10:0'})],
      });

      renderTable();

      expect(await screen.findByText(suggestedProject.slug)).toBeInTheDocument();
      expect(screen.queryByText(secondSuggestedProject.slug)).not.toBeInTheDocument();
      expect(secondPageRequest).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', {name: 'Show more'}));

      expect(await screen.findByText(secondSuggestedProject.slug)).toBeInTheDocument();
      expect(screen.getByText(suggestedProject.slug)).toBeInTheDocument();
      expect(firstPageRequest).toHaveBeenCalledTimes(1);
      expect(secondPageRequest).toHaveBeenCalledTimes(1);
    });

    it('uses the resolved project, agent, and stopping point and refreshes both lists', async () => {
      let repositoriesSaved = false;
      setupSuggestionTable({
        organizationOverrides: {defaultCodingAgentIntegrationId: 123},
        suggestions: () => (repositoriesSaved ? [] : [makeSuggestion()]),
      });
      const repositoriesPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        method: 'PUT',
        body: () => {
          repositoriesSaved = true;
          return {};
        },
      });
      const settingsPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        method: 'PUT',
        body: {},
      });
      const projectUpdate = jest.spyOn(ProjectsStore, 'onUpdateSuccess');

      renderTable();

      await userEvent.click(await screen.findByRole('button', {name: 'Enable Autofix'}));

      await waitFor(() => expect(settingsPut).toHaveBeenCalled());
      expect(repositoriesPut).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        expect.objectContaining({
          method: 'PUT',
          data: {repos: [{repositoryId: 11, branchName: null}]},
        })
      );
      expect(settingsPut).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            agent: 'cursor_background_agent',
            integrationId: '123',
            automationTuning: 'medium',
            stoppingPoint: 'root_cause',
          }),
        })
      );
      expect(repositoriesPut.mock.invocationCallOrder[0]).toBeLessThan(
        settingsPut.mock.invocationCallOrder[0]!
      );
      expect(projectUpdate).toHaveBeenCalledWith(
        expect.objectContaining({id: suggestedProject.id, slug: suggestedProject.slug})
      );
      await waitFor(() =>
        expect(screen.queryByText(suggestedProject.slug)).not.toBeInTheDocument()
      );
    });

    it('forces the Seer agent for a non-GitHub provider', async () => {
      setupSuggestionTable({
        organizationOverrides: {defaultCodingAgentIntegrationId: 123},
        suggestions: [
          makeSuggestion({
            linkedRepositories: [
              {
                repositoryId: '11',
                name: 'getsentry/suggested-repository',
                provider: 'integrations:gitlab',
              },
            ],
          }),
        ],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        method: 'PUT',
        body: {},
      });
      const settingsPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        method: 'PUT',
        body: {},
      });

      renderTable();

      await userEvent.click(await screen.findByRole('button', {name: 'Enable Autofix'}));

      await waitFor(() => expect(settingsPut).toHaveBeenCalled());
      const settingsPayload = settingsPut.mock.calls[0]![1].data;
      expect(settingsPayload.agent).toBe('seer');
      expect(settingsPayload).not.toHaveProperty('integrationId');
    });

    it('disables Enable Autofix while the default agent is pending', async () => {
      setupSuggestionTable({
        codingAgentsDelay: 10_000,
      });

      renderTable();

      expect(await screen.findByRole('button', {name: 'Enable Autofix'})).toBeDisabled();
    });

    it('opens Configure when the full repository count is greater than 10', async () => {
      setupSuggestionTable({
        suggestions: [makeSuggestion({linkedReposCount: 11})],
      });
      const repositoriesPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        method: 'PUT',
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/repos/`,
        body: [],
      });

      renderTable();

      await userEvent.click(await screen.findByRole('button', {name: 'Configure'}));

      await waitFor(() => expect(mockOpenModal).toHaveBeenCalledTimes(1));
      const modalElement = mockOpenModal.mock.calls[0]![0]({});
      expect(modalElement.props.defaultProject).toBe(suggestedProject);
      expect(repositoriesPut).not.toHaveBeenCalled();
    });

    it('sends the row-selected agent and stopping point instead of the defaults', async () => {
      setupSuggestionTable();
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        method: 'PUT',
        body: {},
      });
      const settingsPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        method: 'PUT',
        body: {},
      });

      renderTable();

      const suggestionRow = (
        await screen.findByText(suggestedProject.slug)
      ).closest<HTMLElement>('[role="row"]')!;
      await userEvent.click(await within(suggestionRow).findByText('Seer'));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
      );
      await userEvent.click(within(suggestionRow).getByText('Stop after Root Cause'));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Stop after Plan'})
      );

      await userEvent.click(screen.getByRole('button', {name: 'Enable Autofix'}));

      await waitFor(() => expect(settingsPut).toHaveBeenCalled());
      expect(settingsPut).toHaveBeenCalledWith(
        `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        expect.objectContaining({
          data: expect.objectContaining({
            agent: 'cursor_background_agent',
            integrationId: '123',
            stoppingPoint: 'code_changes',
          }),
        })
      );
    });

    it('requires a stopping point choice when the org default is missing', async () => {
      setupSuggestionTable({
        organizationOverrides: {defaultAutomatedRunStoppingPoint: undefined},
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        method: 'PUT',
        body: {},
      });
      const settingsPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        method: 'PUT',
        body: {},
      });

      renderTable();

      const enableButton = await screen.findByRole('button', {name: 'Enable Autofix'});
      expect(enableButton).toBeDisabled();

      const suggestionRow = screen
        .getByText(suggestedProject.slug)
        .closest<HTMLElement>('[role="row"]')!;
      await userEvent.click(within(suggestionRow).getByText('Select...'));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Stop after Root Cause'})
      );

      await userEvent.click(screen.getByRole('button', {name: 'Enable Autofix'}));

      await waitFor(() => expect(settingsPut).toHaveBeenCalled());
      expect(settingsPut.mock.calls[0]![1].data.stoppingPoint).toBe('root_cause');
    });

    it('disables the action when the full project object is unavailable', async () => {
      setupSuggestionTable();
      ProjectsStore.loadInitialData([project]);

      renderTable();

      expect(await screen.findByRole('button', {name: 'Unavailable'})).toBeDisabled();
    });

    it('keeps the suggestion visible when the repository write fails', async () => {
      setupSuggestionTable();
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        method: 'PUT',
        body: () => {
          throw new Error('repository write failed');
        },
      });
      const settingsPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        method: 'PUT',
      });
      const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

      renderTable();

      await userEvent.click(await screen.findByRole('button', {name: 'Enable Autofix'}));

      await waitFor(() =>
        expect(errorSpy).toHaveBeenCalledWith('Could not enable Autofix. Try again.')
      );
      expect(settingsPut).not.toHaveBeenCalled();
      expect(screen.getByText(suggestedProject.slug)).toBeInTheDocument();
    });

    it('keeps a retry warning across filtering and clears it after retry', async () => {
      let repositoriesSaved = false;
      let settingsAttempts = 0;
      setupSuggestionTable({
        projectSettings: [],
        suggestions: () => (repositoriesSaved ? [] : [makeSuggestion()]),
      });
      const repositoriesPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/repos/`,
        method: 'PUT',
        body: () => {
          repositoriesSaved = true;
          return {};
        },
      });
      const settingsPut = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${suggestedProject.slug}/seer/settings/`,
        method: 'PUT',
        body: () => {
          settingsAttempts += 1;
          if (settingsAttempts === 1) {
            throw new Error('settings write failed');
          }
          return {};
        },
      });

      renderTable();

      await userEvent.click(await screen.findByRole('button', {name: 'Enable Autofix'}));

      expect(
        await screen.findByText(
          'Repositories were saved, but Autofix settings were not. Retry settings to finish setup.'
        )
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByText(suggestedProject.slug)).not.toBeInTheDocument()
      );

      await userEvent.click(await screen.findByText('All'));
      await userEvent.click(await screen.findByRole('option', {name: 'Seer'}));
      expect(
        screen.getByText(
          'Repositories were saved, but Autofix settings were not. Retry settings to finish setup.'
        )
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Retry settings'}));

      await waitFor(() =>
        expect(
          screen.queryByText(
            'Repositories were saved, but Autofix settings were not. Retry settings to finish setup.'
          )
        ).not.toBeInTheDocument()
      );
      expect(repositoriesPut).toHaveBeenCalledTimes(2);
      expect(settingsPut).toHaveBeenCalledTimes(2);
    });

    it('uses the standard table layout when only suggestions exist', async () => {
      setupSuggestionTable({projectSettings: []});

      renderTable();

      expect(await screen.findByText(suggestedProject.slug)).toBeInTheDocument();
      expect(screen.getByText('Suggested')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'Enable Autofix on a Project'})
      ).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
      expect(await screen.findByText('All')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Add Project'})).toBeInTheDocument();
      expect(await screen.findByText('No projects found')).toBeInTheDocument();
    });

    it('shows the large empty state when both configured projects and suggestions are empty', async () => {
      setupSuggestionTable({projectSettings: [], suggestions: []});

      renderTable();

      expect(
        await screen.findByRole('heading', {name: 'Enable Autofix on a Project'})
      ).toBeInTheDocument();
      expect(screen.queryByText('Suggested')).not.toBeInTheDocument();
    });

    it('keeps the configured table usable when the suggestion query fails', async () => {
      setupSuggestionTable({statusCode: 500});

      renderTable();

      expect(await screen.findByText('Could not load suggestions.')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
      expect(screen.getByText(project.slug)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Add Project'})).toBeInTheDocument();
    });
  });
});
