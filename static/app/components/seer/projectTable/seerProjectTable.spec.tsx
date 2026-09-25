import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {SentryNuqsTestingAdapter} from 'sentry-test/nuqsTestingAdapter';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {SeerProjectTable} from 'sentry/components/seer/projectTable/seerProjectTable';
import {ProjectsStore} from 'sentry/stores/projectsStore';

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
  const organization = OrganizationFixture({access: ['org:write']});
  const project = ProjectFixture({id: '2', slug: 'project-slug'});

  function mockBaseEndpoints() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {
        integrations: [{id: '123', provider: 'cursor', name: 'Cursor Cloud Agent'}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      body: [
        {
          projectId: '2',
          projectSlug: 'project-slug',
          agent: 'seer',
          integrationId: null,
          stoppingPoint: 'root_cause',
          autoCreatePr: null,
          automationTuning: 'off',
          scannerAutomation: false,
          prIteration: true,
          reposCount: 1,
        },
      ],
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
    ProjectsStore.loadInitialData([project]);
    mockBaseEndpoints();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.restoreAllMocks();
  });

  function ExampleSeerProjectTable() {
    return (
      <SentryNuqsTestingAdapter>
        <SeerProjectTable />
      </SentryNuqsTestingAdapter>
    );
  }

  it('blocks coding-agent handoff and warns for a project with a non-GitHub repo', async () => {
    mockProjectRepos('gitlab');
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });
    const errorSpy = jest.spyOn(indicators, 'addErrorMessage');

    render(<ExampleSeerProjectTable />, {organization});

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

    render(<ExampleSeerProjectTable />, {organization});

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

    render(<ExampleSeerProjectTable />, {organization});

    await userEvent.click(await screen.findByText('Seer'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Cursor Cloud Agent'})
    );

    // The check passes, so the selection is persisted and no warning is shown.
    await waitFor(() => expect(settingsPut).toHaveBeenCalled());
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('saves the PR iteration toggle for a project', async () => {
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });

    render(<ExampleSeerProjectTable />, {organization});

    expect(await screen.findByText('Auto-Iterate on PRs')).toBeInTheDocument();
    const toggle = await screen.findByRole('checkbox', {
      name: 'Auto-iterate on PRs for project-slug',
    });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() =>
      expect(settingsPut).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {prIteration: false}})
      )
    );
  });

  /**
   * Sets up two projects whose settings live in `server.settings`. The list,
   * bulk-save and row-save mocks all read and write that array, so a refetch
   * after a save sees the change, like a real server.
   */
  function mockTwoProjects() {
    const otherProject = ProjectFixture({id: '3', slug: 'other-project'});
    ProjectsStore.loadInitialData([project, otherProject]);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
    const baseSetting = {
      agent: 'seer',
      integrationId: null,
      autoCreatePr: null,
      automationTuning: 'medium',
      scannerAutomation: false,
      reposCount: 1,
    };
    const server = {
      settings: [
        {
          ...baseSetting,
          projectId: '2',
          projectSlug: 'project-slug',
          stoppingPoint: 'root_cause',
          prIteration: true,
        },
        {
          ...baseSetting,
          projectId: '3',
          projectSlug: 'other-project',
          stoppingPoint: 'code_changes',
          prIteration: false,
        },
      ],
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      body: () => server.settings,
    });
    const bulkPut = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      method: 'PUT',
      body: (_url: string, options: {data: Record<string, unknown>}) => {
        const {query: _query, ...updates} = options.data;
        server.settings = server.settings.map(setting => ({...setting, ...updates}));
        return {};
      },
    });
    const rowPuts = Object.fromEntries(
      ['project-slug', 'other-project'].map(slug => [
        slug,
        MockApiClient.addMockResponse({
          url: `/projects/${organization.slug}/${slug}/seer/settings/`,
          method: 'PUT',
          body: (_url: string, options: {data: Record<string, unknown>}) => {
            server.settings = server.settings.map(setting =>
              setting.projectSlug === slug ? {...setting, ...options.data} : setting
            );
            return {};
          },
        }),
      ])
    );
    return {server, bulkPut, rowPuts};
  }

  /**
   * Returns a promise to pass as a mock's `asyncDelay`, plus a function that
   * lets the response through.
   */
  function makeDelay() {
    let release = () => {};
    const promise = new Promise<void>(resolve => {
      release = resolve;
    });
    return {promise, release};
  }

  async function selectAllProjects() {
    // The first checkbox in the table is the header's "select all".
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
  }

  it('toggles PR iteration for all selected projects', async () => {
    const {bulkPut} = mockTwoProjects();

    render(<ExampleSeerProjectTable />, {organization});

    await screen.findByRole('checkbox', {name: 'Auto-iterate on PRs for other-project'});
    await selectAllProjects();

    // One selected project has PR iteration on, so the bulk toggle reads as on.
    const bulkToggle = await screen.findByRole('checkbox', {
      name: 'Auto-iterate on PRs for selected projects',
    });
    expect(bulkToggle).toBeChecked();

    await userEvent.click(bulkToggle);
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({data: expect.objectContaining({prIteration: false})})
      )
    );
    await waitFor(() => expect(bulkToggle).not.toBeChecked());
    expect(
      screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for project-slug'})
    ).not.toBeChecked();

    await waitFor(() => expect(bulkToggle).toBeEnabled());
    await userEvent.click(bulkToggle);
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({data: expect.objectContaining({prIteration: true})})
      )
    );
    await waitFor(() => expect(bulkToggle).toBeChecked());
    expect(
      screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for other-project'})
    ).toBeChecked();
  });

  it('updates a row switch that was already clicked when the bulk toggle is used', async () => {
    const {bulkPut, rowPuts} = mockTwoProjects();

    render(<ExampleSeerProjectTable />, {organization});

    const getRowToggle = () =>
      screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for other-project'});
    await screen.findByRole('checkbox', {name: 'Auto-iterate on PRs for other-project'});
    await userEvent.click(getRowToggle());
    await waitFor(() => expect(rowPuts['other-project']).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getRowToggle()).toBeEnabled());
    await userEvent.click(getRowToggle());
    await waitFor(() => expect(rowPuts['other-project']).toHaveBeenCalledTimes(2));
    await selectAllProjects();

    // One selected project has PR iteration on, so the bulk toggle reads as on.
    const bulkToggle = await screen.findByRole('checkbox', {
      name: 'Auto-iterate on PRs for selected projects',
    });
    expect(bulkToggle).toBeChecked();

    await waitFor(() => expect(bulkToggle).toBeEnabled());
    await userEvent.click(bulkToggle);
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({data: expect.objectContaining({prIteration: false})})
      )
    );
    await waitFor(() => expect(bulkToggle).not.toBeChecked());
    expect(
      screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for project-slug'})
    ).not.toBeChecked();

    await waitFor(() => expect(bulkToggle).toBeEnabled());
    await userEvent.click(bulkToggle);
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({data: expect.objectContaining({prIteration: true})})
      )
    );
    await waitFor(() => expect(bulkToggle).toBeChecked());
    expect(
      screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for other-project'})
    ).toBeChecked();
  });

  it('updates an automation steps dropdown that was already changed when the bulk menu is used', async () => {
    const {bulkPut, rowPuts} = mockTwoProjects();

    render(<ExampleSeerProjectTable />, {organization});

    // Change project-slug's row from "Root Cause" to "PR drafted".
    await userEvent.click(await screen.findByText('Stop after Root Cause'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Stop after PR drafted'})
    );
    await waitFor(() =>
      expect(rowPuts['project-slug']).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({stoppingPoint: 'open_pr'}),
        })
      )
    );

    await selectAllProjects();
    const bulkMenu = await screen.findByRole('button', {name: 'Automation Steps'});
    await waitFor(() => expect(bulkMenu).toBeEnabled());
    await userEvent.click(bulkMenu);
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: 'Stop after Plan'})
    );
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({stoppingPoint: 'code_changes'}),
        })
      )
    );

    // Both rows, including the one changed by hand, now show the bulk value.
    await waitFor(() => expect(screen.getAllByText('Stop after Plan')).toHaveLength(2));
    expect(screen.queryByText('Stop after PR drafted')).not.toBeInTheDocument();
  });

  it('resets a row switch and marks it invalid when its save fails', async () => {
    mockTwoProjects();
    const failedPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/seer/settings/`,
      method: 'PUT',
      statusCode: 500,
    });

    render(<ExampleSeerProjectTable />, {organization});

    const rowToggle = await screen.findByRole('checkbox', {
      name: 'Auto-iterate on PRs for project-slug',
    });
    expect(rowToggle).toBeChecked();

    await userEvent.click(rowToggle);
    await waitFor(() => expect(failedPut).toHaveBeenCalled());

    // The row keeps its form through its own save, so the form can put the old
    // value back and show that the save failed.
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for project-slug'})
      ).toHaveAttribute('aria-invalid', 'true')
    );
    expect(
      screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for project-slug'})
    ).toBeChecked();
  });

  it('keeps a row switch in place while its own save is in flight', async () => {
    mockTwoProjects();
    const delay = makeDelay();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/seer/settings/`,
      method: 'PUT',
      asyncDelay: delay.promise,
    });

    render(<ExampleSeerProjectTable />, {organization});

    const rowToggle = await screen.findByRole('checkbox', {
      name: 'Auto-iterate on PRs for project-slug',
    });
    await userEvent.click(rowToggle);

    // The click writes the new value into the table's data straight away. The
    // row must keep the same switch through that, because the switch's form is
    // what undoes the change and shows an error if the save then fails.
    await waitFor(() => expect(rowToggle).not.toBeChecked());
    expect(rowToggle).toBeInTheDocument();

    delay.release();
    await waitFor(() => expect(rowToggle).toBeEnabled());
    expect(rowToggle).toBeInTheDocument();
  });

  it('disables the bulk controls while a row is saving', async () => {
    mockTwoProjects();
    const delay = makeDelay();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/seer/settings/`,
      method: 'PUT',
      asyncDelay: delay.promise,
    });

    render(<ExampleSeerProjectTable />, {organization});

    await screen.findByRole('checkbox', {name: 'Auto-iterate on PRs for project-slug'});
    await selectAllProjects();
    const bulkToggle = await screen.findByRole('checkbox', {
      name: 'Auto-iterate on PRs for selected projects',
    });
    expect(bulkToggle).toBeEnabled();

    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for project-slug'})
    );

    await waitFor(() => expect(bulkToggle).toBeDisabled());
    expect(screen.getByRole('button', {name: 'Automation Steps'})).toBeDisabled();

    delay.release();
    await waitFor(() => expect(bulkToggle).toBeEnabled());
    expect(screen.getByRole('button', {name: 'Automation Steps'})).toBeEnabled();
  });

  it('disables the row controls while a bulk edit is saving', async () => {
    mockTwoProjects();
    const delay = makeDelay();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      method: 'PUT',
      asyncDelay: delay.promise,
    });

    render(<ExampleSeerProjectTable />, {organization});

    const rowToggle = await screen.findByRole('checkbox', {
      name: 'Auto-iterate on PRs for other-project',
    });
    await selectAllProjects();
    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: 'Auto-iterate on PRs for selected projects',
      })
    );

    await waitFor(() => expect(rowToggle).toBeDisabled());

    delay.release();
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', {name: 'Auto-iterate on PRs for other-project'})
      ).toBeEnabled()
    );
  });

  it('disables adding a project without organization write access', async () => {
    render(<ExampleSeerProjectTable />, {
      organization: OrganizationFixture({slug: organization.slug, access: []}),
    });

    expect(await screen.findByRole('button', {name: 'Add Project'})).toBeDisabled();
  });
});
