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

  it('saves the PR iteration dropdown for a project', async () => {
    const settingsPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/seer/settings/`,
      method: 'PUT',
    });

    render(<ExampleSeerProjectTable />, {organization});

    expect(await screen.findByText('Auto-Iterate on PRs')).toBeInTheDocument();
    await chooseRowPrIteration('project-slug', 'Off');

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

  function getRowPrIterationSelect(slug: string) {
    return screen.getByRole('textbox', {name: `Auto-iterate on PRs for ${slug}`});
  }

  async function chooseRowPrIteration(slug: string, label: 'On' | 'Off') {
    // The row dropdown's menu renders outside the row, in the page body.
    await userEvent.click(
      await screen.findByRole('textbox', {name: `Auto-iterate on PRs for ${slug}`})
    );
    await userEvent.click(await screen.findByRole('menuitemradio', {name: label}));
  }

  function getRow(slug: string) {
    return screen.getByRole('row', {name: new RegExp(slug)});
  }

  async function chooseBulkPrIteration(label: 'On' | 'Off') {
    const bulkMenu = await screen.findByRole('button', {name: 'Auto-Iterate on PRs'});
    await waitFor(() => expect(bulkMenu).toBeEnabled());
    await userEvent.click(bulkMenu);
    await userEvent.click(await screen.findByRole('menuitemradio', {name: label}));
  }

  it('sets PR iteration for all selected projects', async () => {
    const {bulkPut} = mockTwoProjects();

    render(<ExampleSeerProjectTable />, {organization});

    await screen.findByRole('textbox', {name: 'Auto-iterate on PRs for other-project'});
    await selectAllProjects();

    await chooseBulkPrIteration('Off');
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({data: expect.objectContaining({prIteration: false})})
      )
    );
    await waitFor(() =>
      expect(within(getRow('project-slug')).getByText('Off')).toBeInTheDocument()
    );
    expect(within(getRow('other-project')).getByText('Off')).toBeInTheDocument();

    await chooseBulkPrIteration('On');
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({data: expect.objectContaining({prIteration: true})})
      )
    );
    await waitFor(() =>
      expect(within(getRow('project-slug')).getByText('On')).toBeInTheDocument()
    );
    expect(within(getRow('other-project')).getByText('On')).toBeInTheDocument();
  });

  it('updates a PR iteration dropdown that was already changed when the bulk menu is used', async () => {
    const {bulkPut, rowPuts} = mockTwoProjects();

    render(<ExampleSeerProjectTable />, {organization});

    // Turn other-project's row on by hand.
    await chooseRowPrIteration('other-project', 'On');
    await waitFor(() =>
      expect(rowPuts['other-project']).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {prIteration: true}})
      )
    );

    await selectAllProjects();
    await chooseBulkPrIteration('Off');
    await waitFor(() =>
      expect(bulkPut).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({data: expect.objectContaining({prIteration: false})})
      )
    );

    // Both rows, including the one changed by hand, now show the bulk value.
    await waitFor(() =>
      expect(within(getRow('other-project')).getByText('Off')).toBeInTheDocument()
    );
    expect(within(getRow('project-slug')).getByText('Off')).toBeInTheDocument();
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

  it('marks a row PR iteration dropdown invalid when its save fails', async () => {
    mockTwoProjects();
    const failedPut = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/seer/settings/`,
      method: 'PUT',
      statusCode: 500,
    });

    render(<ExampleSeerProjectTable />, {organization});

    await chooseRowPrIteration('project-slug', 'Off');
    await waitFor(() => expect(failedPut).toHaveBeenCalled());

    // The row keeps its form through its own save, so the form can show that
    // the save failed.
    await waitFor(() =>
      expect(getRowPrIterationSelect('project-slug')).toHaveAttribute(
        'aria-invalid',
        'true'
      )
    );
  });

  it('keeps a row PR iteration dropdown in place while its own save is in flight', async () => {
    mockTwoProjects();
    const delay = makeDelay();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/seer/settings/`,
      method: 'PUT',
      asyncDelay: delay.promise,
    });

    render(<ExampleSeerProjectTable />, {organization});

    const rowSelect = await screen.findByRole('textbox', {
      name: 'Auto-iterate on PRs for project-slug',
    });
    await chooseRowPrIteration('project-slug', 'Off');

    // The change writes the new value into the table's data straight away. The
    // row must keep the same dropdown through that, because the dropdown's form
    // is what shows an error if the save then fails.
    await waitFor(() =>
      expect(within(getRow('project-slug')).getByText('Off')).toBeInTheDocument()
    );
    expect(rowSelect).toBeInTheDocument();

    delay.release();
    await waitFor(() => expect(rowSelect).toBeEnabled());
    expect(rowSelect).toBeInTheDocument();
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

    await screen.findByRole('textbox', {name: 'Auto-iterate on PRs for project-slug'});
    await selectAllProjects();
    const bulkMenu = await screen.findByRole('button', {name: 'Auto-Iterate on PRs'});
    expect(bulkMenu).toBeEnabled();

    await chooseRowPrIteration('project-slug', 'Off');

    await waitFor(() => expect(bulkMenu).toBeDisabled());
    expect(screen.getByRole('button', {name: 'Automation Steps'})).toBeDisabled();

    delay.release();
    await waitFor(() => expect(bulkMenu).toBeEnabled());
    expect(screen.getByRole('button', {name: 'Automation Steps'})).toBeEnabled();
  });

  it('disables the bulk controls while a bulk edit is saving', async () => {
    mockTwoProjects();
    const delay = makeDelay();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/projects/`,
      method: 'PUT',
      asyncDelay: delay.promise,
    });

    render(<ExampleSeerProjectTable />, {organization});

    await screen.findByRole('textbox', {name: 'Auto-iterate on PRs for other-project'});
    await selectAllProjects();
    await chooseBulkPrIteration('Off');

    const bulkMenu = screen.getByRole('button', {name: 'Auto-Iterate on PRs'});
    await waitFor(() => expect(bulkMenu).toBeDisabled());
    expect(screen.getByRole('button', {name: 'Automation Steps'})).toBeDisabled();

    delay.release();
    await waitFor(() => expect(bulkMenu).toBeEnabled());
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

    await screen.findByRole('textbox', {name: 'Auto-iterate on PRs for other-project'});
    await selectAllProjects();
    await chooseBulkPrIteration('Off');

    await waitFor(() => expect(getRowPrIterationSelect('other-project')).toBeDisabled());

    delay.release();
    await waitFor(() => expect(getRowPrIterationSelect('other-project')).toBeEnabled());
  });

  it('leaves the built-in repos filter out of the selection banner', async () => {
    render(<ExampleSeerProjectTable />, {organization});

    await screen.findByRole('textbox', {name: 'Auto-iterate on PRs for project-slug'});
    // The first checkbox in the table is the header's "select all".
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);

    expect(await screen.findByText('Selected 1 project.')).toBeInTheDocument();
    expect(screen.queryByText(/reposCount/)).not.toBeInTheDocument();
  });

  it('disables adding a project without organization write access', async () => {
    render(<ExampleSeerProjectTable />, {
      organization: OrganizationFixture({slug: organization.slug, access: []}),
    });

    expect(await screen.findByRole('button', {name: 'Add Project'})).toBeDisabled();
  });
});
