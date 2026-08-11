import {
  InvestigationBlockFixture,
  InvestigationDetailFixture,
} from 'sentry-fixture/investigation';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TopBar} from 'sentry/views/navigation/topBar';
import SeerInvestigation from 'sentry/views/seerNotebook/investigation';

describe('SeerInvestigation', () => {
  const organization = OrganizationFixture({
    features: ['investigations', 'investigations-query-execution'],
  });
  const detail = InvestigationDetailFixture();
  const detailUrl = `/organizations/${organization.slug}/investigations/${detail.id}/`;

  beforeEach(() => {
    act(() =>
      ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})])
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [MemberFixture({id: '1', name: 'Test User'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture({id: '1', slug: 'frontend'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });
  });

  afterEach(() => PageFiltersStore.reset());

  function renderInvestigation(response = detail, currentOrganization = organization) {
    MockApiClient.addMockResponse({url: detailUrl, body: response});
    return render(
      <TopBar.Slot.Provider>
        <TopBar />
        <SeerInvestigation />
      </TopBar.Slot.Provider>,
      {
        organization: currentOrganization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/seer/${detail.id}/`,
          },
          route: '/organizations/:orgId/seer/:investigationId/',
        },
      }
    );
  }

  it('shows the investigation breadcrumb and notebook header controls', async () => {
    renderInvestigation();

    expect(await screen.findByRole('link', {name: 'Investigations'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/seer/`
    );
    expect(screen.getByRole('button', {name: 'Star investigation'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit history'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Investigation settings'})
    ).toBeInTheDocument();
    expect(screen.getByText('All Envs')).toBeInTheDocument();
    expect(screen.getByText('All Releases')).toBeInTheDocument();
    expect(screen.getByText('10 minutes')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: detail.title})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Edit investigation name'})
    ).toHaveTextContent(detail.title);
  });

  it('keeps only access and archive controls in investigation settings', async () => {
    MockApiClient.addMockResponse({
      url: `${detailUrl}permissions/`,
      body: detail.permissions,
    });
    renderGlobalModal();
    renderInvestigation();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Investigation settings'})
    );

    expect(
      await screen.findByRole('heading', {name: 'Investigation settings'})
    ).toBeInTheDocument();
    expect(screen.getByText('Access')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', {name: 'Who can edit'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Archive investigation'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Default project')).not.toBeInTheDocument();
  });

  it('loads persisted blocks and saves a renamed investigation', async () => {
    const updateRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: {...detail, title: 'Checkout follow-up', version: 2},
    });
    renderInvestigation();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Edit investigation name'})
    );
    const title = await screen.findByRole('textbox', {
      name: 'Investigation name',
    });
    await userEvent.clear(title);
    await userEvent.type(title, 'Checkout follow-up');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(updateRequest).toHaveBeenCalled());
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({title: 'Checkout follow-up'}),
      })
    );
    expect(screen.getByRole('button', {name: 'Run'})).toBeDisabled();
  });

  it('creates a persisted query block', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      position: 1,
      kind: 'query',
      title: '',
      content: '',
      display: {type: 'table', queryCollapsed: false},
    });
    const createRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/blocks/`,
      method: 'POST',
      body: queryBlock,
    });
    renderInvestigation();

    await userEvent.click(await screen.findByRole('button', {name: 'Add block'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Query'}));

    await waitFor(() => expect(createRequest).toHaveBeenCalled());
    const queryEditor = await screen.findByRole('textbox', {
      name: 'Query block 2',
    });
    expect(queryEditor).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Run'}).at(-1)).toBeDisabled();

    const suggestion =
      'Compare error volume over time across the selected projects. Show daily error counts for the last 30 days, grouped by project.';
    await userEvent.click(screen.getByRole('button', {name: 'see an example'}));
    expect(queryEditor).not.toHaveValue(suggestion);
    await waitFor(() => expect(queryEditor).toHaveValue(suggestion), {
      timeout: 3000,
    });
  });

  it('keeps a legacy query empty after deleting all of its text', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      content: 'Show unresolved errors',
      generationPrompt: '',
      display: {type: 'table', queryCollapsed: false},
    });
    const withLegacyQuery = InvestigationDetailFixture({blocks: [queryBlock]});
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withLegacyQuery.id}/blocks/${queryBlock.id}/`,
      method: 'PUT',
      body: {
        ...queryBlock,
        content: '',
        generationPrompt: '',
        version: queryBlock.version + 1,
      },
    });
    renderInvestigation(withLegacyQuery);

    const queryEditor = await screen.findByRole('textbox', {
      name: 'Query block 1',
    });
    expect(queryEditor).toHaveValue('Show unresolved errors');

    await userEvent.clear(queryEditor);

    expect(queryEditor).toHaveValue('');
    expect(screen.getByRole('button', {name: 'Run'})).toBeDisabled();
    await waitFor(() => expect(updateRequest).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({content: '', generationPrompt: ''}),
      })
    );
  });

  it('runs a query block through its durable execution endpoint', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show unresolved errors over the last day',
      outputStatus: 'notRun',
      version: 3,
    });
    const withQuery = InvestigationDetailFixture({
      blocks: [queryBlock],
      version: 7,
    });
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withQuery.id}/blocks/${queryBlock.id}/execute/`,
      method: 'POST',
      body: {id: 'execution-1', status: 'running'},
    });
    renderInvestigation(withQuery);

    await userEvent.click(await screen.findByRole('button', {name: 'Run'}));

    await waitFor(() => expect(executeRequest).toHaveBeenCalled());
    expect(executeRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          investigationVersion: 7,
          requestId: expect.any(String),
          version: 3,
        },
      })
    );
  });

  it('restores a running button after reload without starting another execution', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show unresolved errors over the last day',
      outputStatus: 'running',
      currentExecution: {
        id: 'execution-1',
        status: 'running',
        executor: 'code_mode',
        schemaVersion: 1,
        error: null,
        startedAt: '2026-08-02T05:40:19Z',
        completedAt: null,
      },
    });
    const withRunningQuery = InvestigationDetailFixture({blocks: [queryBlock]});
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withRunningQuery.id}/blocks/${queryBlock.id}/execute/`,
      method: 'POST',
      body: {id: 'unexpected', status: 'running'},
    });

    renderInvestigation(withRunningQuery);

    const runningButton = await screen.findByRole('button', {
      name: 'Stop query',
    });
    expect(runningButton).toBeEnabled();
    expect(runningButton).not.toHaveTextContent('Working');
    expect(screen.getByTestId('block-run-spinner')).toBeInTheDocument();
    expect(await screen.findByText('Thinking')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Thinking'})).toBeDisabled();
    expect(executeRequest).not.toHaveBeenCalled();
  });

  it('shows a persisted query error and retries it inline', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show unresolved errors over the last day',
      outputStatus: 'failed',
      currentExecution: {
        id: 'execution-1',
        status: 'failed',
        executor: 'code_mode',
        schemaVersion: 1,
        error: {
          code: 'seer_execution_failed',
          message: 'agent_run_errored',
        },
        startedAt: '2026-08-02T05:40:19Z',
        completedAt: '2026-08-02T05:40:40Z',
      },
    });
    const withFailedQuery = InvestigationDetailFixture({blocks: [queryBlock]});
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withFailedQuery.id}/blocks/${queryBlock.id}/execute/`,
      method: 'POST',
      body: {id: 'execution-2', status: 'running'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withFailedQuery.id}/blocks/${queryBlock.id}/executions/execution-1/`,
      body: {
        id: 'execution-1',
        status: 'failed',
        blocks: [
          {
            id: 'tool',
            loading: false,
            message: {
              role: 'tool_use',
              tool_calls: [
                {
                  function: 'sentry_api_execute',
                  args: '{"code":"sentry.telemetry_live_search()"}',
                },
              ],
            },
            toolResults: [{content: 'Lint failed'}],
          },
        ],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: queryBlock.currentExecution?.error,
      },
    });

    renderInvestigation(withFailedQuery);

    expect(await screen.findByText('agent_run_errored')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {name: 'Stopped because of an error'})
    );
    expect(await screen.findByText('sentry.telemetry_live_search()')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    await waitFor(() => expect(executeRequest).toHaveBeenCalled());
    expect(executeRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({requestId: expect.any(String)}),
      })
    );
  });

  it('does not expose inline execution when the execution flag is explicitly off', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show unresolved errors over the last day',
    });
    const organizationWithoutExecution = OrganizationFixture({
      slug: organization.slug,
      features: ['investigations'],
    });

    renderInvestigation(
      InvestigationDetailFixture({blocks: [queryBlock]}),
      organizationWithoutExecution
    );

    expect(await screen.findByRole('button', {name: 'Run'})).toBeDisabled();
  });

  it('persists collapsing only the natural language query section', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show error volume',
      display: {type: 'table', queryCollapsed: false},
    });
    const withQuery = InvestigationDetailFixture({blocks: [queryBlock]});
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withQuery.id}/blocks/${queryBlock.id}/`,
      method: 'PUT',
      body: {
        ...queryBlock,
        version: queryBlock.version + 1,
        display: {version: 1, type: 'table', queryCollapsed: true},
      },
    });
    renderInvestigation(withQuery);

    expect(
      await screen.findByRole('textbox', {name: 'Query block 1'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Natural language query'}));

    expect(
      screen.queryByRole('textbox', {name: 'Query block 1'})
    ).not.toBeInTheDocument();
    await waitFor(() => expect(updateRequest).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          display: expect.objectContaining({
            version: 1,
            queryCollapsed: true,
          }),
        }),
      })
    );
  });

  it('collapses prompt sections by default while keeping their actions visible', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show error volume grouped by project and environment',
      display: {type: 'table'},
    });
    const textBlock = InvestigationBlockFixture({
      id: 'text-block',
      position: 1,
      generationPrompt: 'Summarize the most important changes in the result',
      display: {type: 'markdown'},
    });

    renderInvestigation(InvestigationDetailFixture({blocks: [queryBlock, textBlock]}));

    expect(
      await screen.findByRole('button', {
        name: 'Show error volume grouped by project and environment',
      })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', {
        name: 'Summarize the most important changes in the result',
      })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('textbox', {name: 'Query block 1'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Text generation prompt 2'})
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Run'})).toHaveLength(2);
    expect(screen.queryByRole('button', {name: 'Generate'})).not.toBeInTheDocument();
  });

  it('shows dependent auto-run blocks as waiting for earlier blocks', async () => {
    const parent = InvestigationBlockFixture({
      id: 'parent-block',
      kind: 'query',
      generationPrompt: 'Count checkout errors',
      config: {autoRun: true},
      display: {type: 'table'},
    });
    const dependent = InvestigationBlockFixture({
      id: 'dependent-block',
      position: 1,
      generationPrompt: 'Summarize the result briefly',
      config: {autoRun: true},
      dependencies: [parent.id],
      display: {type: 'markdown'},
    });

    renderInvestigation(InvestigationDetailFixture({blocks: [parent, dependent]}));

    expect(await screen.findByText('Waiting for earlier blocks')).toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });

  it('shows dependent auto-run blocks as blocked when an earlier block fails', async () => {
    const parent = InvestigationBlockFixture({
      id: 'parent-block',
      kind: 'query',
      generationPrompt: 'Count checkout errors',
      config: {autoRun: true},
      outputStatus: 'failed',
      currentExecution: {
        id: 'parent-execution',
        status: 'failed',
        executor: 'code_mode',
        schemaVersion: 1,
        error: {code: 'invalid_result', message: 'Malformed result'},
        startedAt: '2026-08-05T00:00:00Z',
        completedAt: '2026-08-05T00:01:00Z',
      },
      display: {type: 'table'},
    });
    const dependent = InvestigationBlockFixture({
      id: 'dependent-block',
      position: 1,
      generationPrompt: 'Summarize the result briefly',
      config: {autoRun: true},
      dependencies: [parent.id],
      display: {type: 'markdown'},
    });

    renderInvestigation(InvestigationDetailFixture({blocks: [parent, dependent]}));

    expect(
      await screen.findByText('Blocked because an earlier block did not complete.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Waiting for earlier blocks')).not.toBeInTheDocument();
  });

  it('switches a typed persisted result from table to chart without rerunning', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show error volume',
      outputStatus: 'available',
      display: {
        version: 1,
        type: 'table',
        defaultView: 'table',
        queryCollapsed: false,
      },
      output: {
        schemaVersion: 1,
        tableMarkdown: '| Errors |\n| ---: |\n| 12 |',
        chart: {
          x_axis: 'time',
          visualization: 'area',
          title: 'Error volume',
          y_axis_unit: 'number',
          stacked: false,
          show_legend: true,
          series: [
            {
              name: 'count()',
              data: [
                {x: '2026-07-31T12:00:00Z', y: 12},
                {x: '2026-07-31T13:00:00Z', y: 18},
                {x: '2026-07-31T14:00:00Z', y: 15},
              ],
            },
          ],
        },
        preferredView: 'table',
        isEmpty: false,
        chartUnavailableReason: null,
        queryLinks: [
          {
            kind: 'telemetry',
            params: {dataset: 'errors', query: 'is:unresolved'},
          },
        ],
      },
    });
    const withResult = InvestigationDetailFixture({blocks: [queryBlock]});
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withResult.id}/blocks/${queryBlock.id}/execute/`,
      method: 'POST',
      body: {id: 'unexpected', status: 'running'},
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withResult.id}/blocks/${queryBlock.id}/`,
      method: 'PUT',
      body: {
        ...queryBlock,
        version: queryBlock.version + 1,
        display: {
          version: 1,
          type: 'area',
          defaultView: 'chart',
          xAxis: 'timestamp',
          yAxes: ['count()'],
          unit: 'number',
          stacked: false,
          showLegend: true,
          title: 'Error volume',
          sort: 'descending',
        },
      },
    });
    renderInvestigation(withResult);

    expect(await screen.findByText('Errors')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Query block 1'})).toHaveValue(
      'Show error volume'
    );
    expect(
      screen.queryByRole('button', {name: 'Generated query'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: '1 underlying queries'}));
    expect(screen.getByText(/is:unresolved/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Result settings'}));
    expect(screen.getByRole('dialog', {name: 'Result settings'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Chart'}));

    expect(await screen.findByTestId('seer-chart-embed')).toBeInTheDocument();
    await waitFor(() => expect(updateRequest).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          display: expect.objectContaining({
            defaultView: 'chart',
          }),
        }),
      })
    );
    expect(executeRequest).not.toHaveBeenCalled();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Table'}));
    expect(screen.getByText('Errors')).toBeInTheDocument();
    await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(2), {
      timeout: 2000,
    });
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          display: expect.objectContaining({defaultView: 'table'}),
        }),
      })
    );
  });

  it('renders a table shell when a successful query returns no rows or columns', async () => {
    const queryBlock = InvestigationBlockFixture({
      id: 'query-block',
      kind: 'query',
      generationPrompt: 'Show errors from a nonexistent release',
      outputStatus: 'available',
      display: {version: 1, type: 'table', defaultView: 'table'},
      output: {
        schemaVersion: 1,
        tableMarkdown: '| Result |\n| --- |',
        chart: null,
        preferredView: 'table',
        isEmpty: true,
        chartUnavailableReason: 'No meaningful chart data was returned.',
        queryLinks: [],
      },
    });

    renderInvestigation(InvestigationDetailFixture({blocks: [queryBlock]}));

    expect(await screen.findByText('Result')).toBeInTheDocument();
    expect(screen.getByText('No data returned for this query.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Result settings'}));
    expect(screen.getByRole('button', {name: 'Chart'})).toBeDisabled();
  });

  it('opens the lazy add-block menu from the keyboard', async () => {
    renderInvestigation();

    const addBlock = await screen.findByRole('button', {name: 'Add block'});
    addBlock.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('menuitemradio', {name: 'Text'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Query'})).toBeInTheDocument();
  });

  it('keeps notebook edits disabled for viewers', async () => {
    const readOnly = InvestigationDetailFixture({
      permissions: {...detail.permissions, canEdit: false, canManage: false},
    });
    renderInvestigation(readOnly);

    expect(await screen.findByText('View only')).toBeInTheDocument();
    expect(screen.getByText('Understand the regression.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Add block'})).not.toBeInTheDocument();
  });

  it('filters and keyboard-navigates block commands in a text block', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        detail.id
      }/blocks/${detail.blocks[0]!.id}/`,
      method: 'PUT',
      body: InvestigationBlockFixture({content: '## ', version: 2}),
    });
    renderInvestigation(
      InvestigationDetailFixture({
        blocks: [InvestigationBlockFixture({content: ''})],
      })
    );

    const editor = await screen.findByRole('textbox', {name: 'Text block 1'});
    await userEvent.type(editor, '/');

    expect(screen.getByRole('option', {name: 'Heading 1 #'})).toBeInTheDocument();
    expect(
      screen.getByRole('option', {name: 'Query block Insert below'})
    ).toBeInTheDocument();

    await userEvent.type(editor, 'head');
    expect(
      screen.queryByRole('option', {name: 'Query block Insert below'})
    ).not.toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(editor).toHaveValue('## ');
  });

  it('renders markdown syntax in place when a text block is committed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        detail.id
      }/blocks/${detail.blocks[0]!.id}/`,
      method: 'PUT',
      body: InvestigationBlockFixture({content: '# Hello', version: 2}),
    });
    renderInvestigation(
      InvestigationDetailFixture({
        blocks: [InvestigationBlockFixture({content: ''})],
      })
    );

    const editor = await screen.findByRole('textbox', {name: 'Text block 1'});
    await userEvent.type(editor, '# Hello');
    await userEvent.tab();

    expect(screen.getByRole('heading', {name: 'Hello'})).toBeInTheDocument();
  });

  it('runs a text-block prompt inline and shows its linked context', async () => {
    const textBlock = InvestigationBlockFixture({
      id: 'text-block',
      kind: 'text',
      content: 'Existing notes',
      generationPrompt: 'Summarize the most important change as Markdown.',
      dependencies: ['query-block'],
      outputStatus: 'notRun',
      display: {type: 'markdown', promptCollapsed: false},
      version: 3,
    });
    const withTextPrompt = InvestigationDetailFixture({
      blocks: [textBlock],
      version: 7,
    });
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withTextPrompt.id}/blocks/${textBlock.id}/execute/`,
      method: 'POST',
      body: {id: 'execution-1', status: 'running'},
    });
    renderInvestigation(withTextPrompt);

    expect(
      await screen.findByRole('textbox', {name: 'Text generation prompt 1'})
    ).toHaveValue('Summarize the most important change as Markdown.');
    expect(screen.getByText('Uses 1 linked block(s) as context.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Run'}));

    await waitFor(() => expect(executeRequest).toHaveBeenCalled());
    expect(executeRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          investigationVersion: 7,
          requestId: expect.any(String),
          version: 3,
        },
      })
    );
  });

  it('restores an in-block text generation state after reload', async () => {
    const textBlock = InvestigationBlockFixture({
      id: 'text-block',
      kind: 'text',
      content: 'Previous summary',
      generationPrompt: 'Rewrite this summary.',
      outputStatus: 'running',
      currentExecution: {
        id: 'execution-1',
        status: 'running',
        executor: 'text_generation',
        schemaVersion: 1,
        error: null,
        startedAt: '2026-08-03T12:00:00Z',
        completedAt: null,
      },
    });
    renderInvestigation(InvestigationDetailFixture({blocks: [textBlock]}));

    const stopButton = await screen.findByRole('button', {
      name: 'Stop generation',
    });
    expect(stopButton).toBeEnabled();
    expect(screen.getByText('Thinking')).toBeInTheDocument();
    expect(screen.getByText('Previous summary')).toBeInTheDocument();
  });

  it('inserts a block between existing blocks and persists the new order', async () => {
    const secondBlock = InvestigationBlockFixture({
      id: 'second-block',
      position: 1,
    });
    const withTwoBlocks = InvestigationDetailFixture({
      blocks: [detail.blocks[0]!, secondBlock],
    });
    const insertedBlock = InvestigationBlockFixture({
      id: 'inserted-block',
      position: 2,
      content: '',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/blocks/`,
      method: 'POST',
      body: insertedBlock,
    });
    const reorderRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/blocks/order/`,
      method: 'PUT',
      body: {
        ...withTwoBlocks,
        version: 3,
        blocks: [withTwoBlocks.blocks[0]!, insertedBlock, secondBlock],
      },
    });
    renderInvestigation(withTwoBlocks);

    await userEvent.click(await screen.findByRole('button', {name: 'Add block here'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));

    await waitFor(() => expect(reorderRequest).toHaveBeenCalled());
    expect(reorderRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          blockIds: [detail.blocks[0]!.id, insertedBlock.id, secondBlock.id],
        }),
      })
    );
  });

  it('preserves the local draft and offers recovery after a version conflict', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      statusCode: 409,
      body: {detail: 'Version conflict'},
    });
    renderInvestigation();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Edit investigation name'})
    );
    const title = await screen.findByRole('textbox', {
      name: 'Investigation name',
    });
    await userEvent.clear(title);
    await userEvent.type(title, 'My local draft');
    await userEvent.keyboard('{Enter}');

    expect(
      await screen.findByText(
        'This investigation changed elsewhere. Your local draft is still here.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Edit investigation name'})
    ).toHaveTextContent('My local draft');
    expect(screen.getByRole('button', {name: 'Reload latest'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry my change'})).toBeInTheDocument();
  });

  it('reorders blocks through the drag handle', async () => {
    const secondBlock = InvestigationBlockFixture({
      id: 'second-block',
      position: 1,
    });
    const withTwoBlocks = InvestigationDetailFixture({
      blocks: [detail.blocks[0]!, secondBlock],
    });
    const reorderRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/blocks/order/`,
      method: 'PUT',
      body: {
        ...withTwoBlocks,
        version: 2,
        blocks: [secondBlock, detail.blocks[0]!],
      },
    });
    renderInvestigation(withTwoBlocks);

    expect(await screen.findAllByText('Understand the regression.')).toHaveLength(2);
    const articles = document.querySelectorAll('article');
    expect(articles).toHaveLength(2);
    articles.forEach((article, index) => {
      article.getBoundingClientRect = () => ({
        bottom: index * 100 + 80,
        height: 80,
        left: 0,
        right: 800,
        top: index * 100,
        width: 800,
        x: 0,
        y: index * 100,
        toJSON: () => {},
      });
    });

    const handles = screen.getAllByRole('button', {name: 'Drag to reorder'});
    fireEvent(handles[0]!, makePointerEvent('pointerdown', 10));
    fireEvent(document, makePointerEvent('pointermove', 20));
    await waitFor(() =>
      expect(document.querySelector('[id^="DndLiveRegion"]')).toHaveTextContent(
        'was moved over'
      )
    );
    fireEvent(document, makePointerEvent('pointermove', 130));
    await act(async () => Promise.resolve());
    fireEvent(document, makePointerEvent('pointerup', 130));

    await waitFor(() => expect(reorderRequest).toHaveBeenCalled());
    expect(reorderRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          blockIds: [secondBlock.id, detail.blocks[0]!.id],
        }),
      })
    );
  });

  it('validates declared parameter constraints before saving', async () => {
    const withParameter = InvestigationDetailFixture({
      parameters: [
        {
          id: 'parameter-id',
          key: 'environment',
          label: 'Environment',
          description: '',
          type: 'string',
          required: true,
          constraints: {maxLength: 5},
          defaultValue: 'prod',
          savedValue: 'prod',
          source: 'template',
          position: 0,
          version: 1,
        },
      ],
    });
    renderInvestigation(withParameter);

    const parameter = await screen.findByDisplayValue('prod');
    fireEvent.change(parameter, {target: {value: ''}});
    expect(screen.getByText('This parameter is required.')).toBeInTheDocument();

    fireEvent.change(parameter, {target: {value: 'production'}});
    expect(screen.getByText('Use no more than 5 characters.')).toBeInTheDocument();
  });
});

function makePointerEvent(type: string, clientY: number) {
  const event = new Event(type, {bubbles: true, cancelable: true});
  Object.defineProperties(event, {
    button: {value: 0},
    clientX: {value: 10},
    clientY: {value: clientY},
    isPrimary: {value: true},
    pointerId: {value: 1},
  });
  return event;
}
