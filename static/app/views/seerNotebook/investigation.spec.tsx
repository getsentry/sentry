import {
  InvestigationCellFixture,
  InvestigationCommentFixture,
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

  it('loads persisted cells and saves a renamed investigation', async () => {
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
    expect(screen.queryByRole('button', {name: 'Run'})).not.toBeInTheDocument();
  });

  it('creates a persisted query cell', async () => {
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
      position: 1,
      kind: 'query',
      title: '',
      content: '',
      display: {type: 'table'},
    });
    const createRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/`,
      method: 'POST',
      body: queryCell,
    });
    renderInvestigation();

    await userEvent.click(await screen.findByRole('button', {name: 'Add cell'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Query'}));

    await waitFor(() => expect(createRequest).toHaveBeenCalled());
    const queryEditor = await screen.findByRole('textbox', {
      name: 'Query cell 2',
    });
    expect(queryEditor).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Run'})).toBeDisabled();

    const suggestion = 'Show errors over time for the selected projects';
    await userEvent.click(screen.getByRole('button', {name: 'see an example'}));
    expect(queryEditor).not.toHaveValue(suggestion);
    await waitFor(() => expect(queryEditor).toHaveValue(suggestion), {
      timeout: 2000,
    });
  });

  it('runs a query cell through its durable execution endpoint', async () => {
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
      kind: 'query',
      generationPrompt: 'Show unresolved errors over the last day',
      outputStatus: 'notRun',
      version: 3,
    });
    const withQuery = InvestigationDetailFixture({
      cells: [queryCell],
      version: 7,
    });
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withQuery.id}/cells/${queryCell.id}/execute/`,
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
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
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
    const withRunningQuery = InvestigationDetailFixture({cells: [queryCell]});
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withRunningQuery.id}/cells/${queryCell.id}/execute/`,
      method: 'POST',
      body: {id: 'unexpected', status: 'running'},
    });

    renderInvestigation(withRunningQuery);

    const runningButton = await screen.findByRole('button', {
      name: 'Running',
    });
    expect(runningButton).toBeDisabled();
    expect(runningButton).toHaveAttribute('aria-busy', 'true');
    expect(executeRequest).not.toHaveBeenCalled();
  });

  it('shows a persisted query error and retries it inline', async () => {
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
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
    const withFailedQuery = InvestigationDetailFixture({cells: [queryCell]});
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withFailedQuery.id}/cells/${queryCell.id}/execute/`,
      method: 'POST',
      body: {id: 'execution-2', status: 'running'},
    });

    renderInvestigation(withFailedQuery);

    expect(await screen.findByRole('alert')).toHaveTextContent('Query failed');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't finish this query. Try running it again."
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('agent_run_errored');
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
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
      kind: 'query',
      generationPrompt: 'Show unresolved errors over the last day',
    });
    const organizationWithoutExecution = OrganizationFixture({
      slug: organization.slug,
      features: ['investigations'],
    });

    renderInvestigation(
      InvestigationDetailFixture({cells: [queryCell]}),
      organizationWithoutExecution
    );

    expect(await screen.findByRole('button', {name: 'Run'})).toBeDisabled();
  });

  it('persists collapsing only the natural language query section', async () => {
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
      kind: 'query',
      generationPrompt: 'Show error volume',
      display: {type: 'table'},
    });
    const withQuery = InvestigationDetailFixture({cells: [queryCell]});
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withQuery.id}/cells/${queryCell.id}/`,
      method: 'PUT',
      body: {
        ...queryCell,
        version: queryCell.version + 1,
        display: {version: 1, type: 'table', queryCollapsed: true},
      },
    });
    renderInvestigation(withQuery);

    expect(
      await screen.findByRole('textbox', {name: 'Query cell 1'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Natural language query'}));

    expect(screen.queryByRole('textbox', {name: 'Query cell 1'})).not.toBeInTheDocument();
    await waitFor(() => expect(updateRequest).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          display: expect.objectContaining({version: 1, queryCollapsed: true}),
        }),
      })
    );
  });

  it('switches a typed persisted result from table to chart without rerunning', async () => {
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
      kind: 'query',
      generationPrompt: 'Show error volume',
      outputStatus: 'available',
      display: {version: 1, type: 'table', defaultView: 'table'},
      output: {
        schemaVersion: 1,
        query: {
          dataset: 'errors',
          query: 'is:unresolved',
          mode: 'aggregates',
          fields: [],
          yAxes: ['count()'],
          groupBy: [],
          sort: '',
          timeRange: {statsPeriod: '24h'},
          projectIds: [1],
          projectSlugs: ['frontend'],
          linkParams: {},
        },
        table: {
          columns: [{key: 'count()', label: 'Errors', type: 'number'}],
          rows: [[12]],
          totalRows: 1,
          returnedRows: 1,
          truncated: false,
        },
        chart: {
          xAxis: 'time',
          truncated: false,
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
        suggestedVisualization: {
          type: 'area',
          title: 'Error volume',
          xField: 'timestamp',
          yFields: ['count()'],
          unit: 'number',
          stacked: false,
          showLegend: true,
          sort: 'none',
        },
        chartUnavailableReason: null,
        warnings: [],
        dataProjectIds: [1],
      },
    });
    const withResult = InvestigationDetailFixture({cells: [queryCell]});
    const executeRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withResult.id}/cells/${queryCell.id}/execute/`,
      method: 'POST',
      body: {id: 'unexpected', status: 'running'},
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${withResult.id}/cells/${queryCell.id}/`,
      method: 'PUT',
      body: {
        ...queryCell,
        version: queryCell.version + 1,
        display: {
          version: 1,
          type: 'area',
          defaultView: 'table',
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
    expect(screen.getByRole('textbox', {name: 'Query cell 1'})).toHaveValue(
      'Show error volume'
    );
    expect(
      screen.queryByRole('button', {name: 'Generated query'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Query details'}));
    expect(screen.getByText('is:unresolved')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Chart'}));

    expect(await screen.findByTestId('seer-chart-embed')).toBeInTheDocument();
    expect(screen.queryByText('Error volume')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', {name: 'X-axis field'})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Chart settings'}));
    expect(screen.getByRole('combobox', {name: 'X-axis field'})).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', {name: 'Series or color field'})
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Y-axis label'})).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Chart subtitle'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Chart title'})).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Series layout'})).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', {name: 'Top N points'})).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole('combobox', {name: 'Chart sort'}),
      'descending'
    );
    await waitFor(() => expect(updateRequest).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          display: expect.objectContaining({
            sort: 'descending',
            xAxis: 'timestamp',
            yAxes: ['count()'],
          }),
        }),
      })
    );
    expect(executeRequest).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Close chart settings'}));
    await userEvent.click(screen.getByRole('button', {name: 'Both'}));
    expect(screen.getByTestId('seer-chart-embed')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(2), {
      timeout: 2000,
    });
    expect(updateRequest).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          display: expect.objectContaining({defaultView: 'both'}),
        }),
      })
    );
  });

  it('renders a table shell when a successful query returns no rows or columns', async () => {
    const queryCell = InvestigationCellFixture({
      id: 'query-cell',
      kind: 'query',
      generationPrompt: 'Show errors from a nonexistent release',
      outputStatus: 'available',
      display: {version: 1, type: 'table', defaultView: 'table'},
      output: {
        schemaVersion: 1,
        query: {
          dataset: 'errors',
          query: 'release:does-not-exist',
          mode: 'samples',
          fields: [],
          yAxes: [],
          groupBy: [],
          sort: '',
          timeRange: {statsPeriod: '24h'},
          projectIds: [1],
          projectSlugs: ['frontend'],
          linkParams: {},
        },
        table: {
          columns: [],
          rows: [],
          totalRows: 0,
          returnedRows: 0,
          truncated: false,
        },
        chart: null,
        suggestedVisualization: null,
        chartUnavailableReason: 'No meaningful chart data was returned.',
        warnings: [],
        dataProjectIds: [1],
      },
    });

    renderInvestigation(InvestigationDetailFixture({cells: [queryCell]}));

    expect(await screen.findByText('Result')).toBeInTheDocument();
    expect(screen.getByText('No data returned for this query.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Chart'})).toBeDisabled();
  });

  it('opens the lazy add-cell menu from the keyboard', async () => {
    renderInvestigation();

    const addCell = await screen.findByRole('button', {name: 'Add cell'});
    addCell.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('menuitemradio', {name: 'Text'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Query'})).toBeInTheDocument();
  });

  it('opens the comment popover and loads the linear comment stream', async () => {
    const withComments = InvestigationDetailFixture({
      cells: [InvestigationCellFixture({commentCount: 1})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        detail.id
      }/cells/${withComments.cells[0]!.id}/comments/`,
      body: [InvestigationCommentFixture()],
    });
    renderInvestigation(withComments);

    await userEvent.click(await screen.findByRole('button', {name: 'Comments, 1'}));

    expect(await screen.findByText('I can reproduce this.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Add a comment'})).toBeInTheDocument();
  });

  it('expands reactions in place as an icon-only picker', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        detail.id
      }/cells/${detail.cells[0]!.id}/comments/`,
      body: [],
    });
    renderInvestigation();

    await userEvent.click(await screen.findByRole('button', {name: 'Comments, 0'}));
    expect(
      await screen.findByRole('dialog', {name: 'Cell comments'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Add reaction'}));

    const thumbsUp = screen.getByRole('button', {name: 'Thumbs up'});
    expect(thumbsUp).toHaveTextContent('👍');
    expect(thumbsUp).not.toHaveTextContent('Thumbs up');
    expect(screen.getByRole('button', {name: 'Eyes'})).toHaveTextContent('👀');
    expect(
      screen.queryByRole('button', {name: 'Browse all reactions'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', {name: 'Cell comments'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Comments, 0'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Delete cell 1'})).not.toBeInTheDocument();
  });

  it('keeps notebook edits disabled for viewers while allowing comments', async () => {
    const readOnly = InvestigationDetailFixture({
      permissions: {...detail.permissions, canEdit: false, canManage: false},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        detail.id
      }/cells/${readOnly.cells[0]!.id}/comments/`,
      body: [],
    });
    renderInvestigation(readOnly);

    expect(await screen.findByText('View only')).toBeInTheDocument();
    expect(screen.getByText('Understand the regression.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Add cell'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Comments, 0'}));
    expect(await screen.findByRole('textbox', {name: 'Add a comment'})).toBeEnabled();
  });

  it('filters and keyboard-navigates block commands in a text cell', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        detail.id
      }/cells/${detail.cells[0]!.id}/`,
      method: 'PUT',
      body: InvestigationCellFixture({content: '## ', version: 2}),
    });
    renderInvestigation(
      InvestigationDetailFixture({
        cells: [InvestigationCellFixture({content: ''})],
      })
    );

    const editor = await screen.findByRole('textbox', {name: 'Text cell 1'});
    await userEvent.type(editor, '/');

    expect(screen.getByRole('option', {name: 'Heading 1 #'})).toBeInTheDocument();
    expect(
      screen.getByRole('option', {name: 'Query cell Insert below'})
    ).toBeInTheDocument();

    await userEvent.type(editor, 'head');
    expect(
      screen.queryByRole('option', {name: 'Query cell Insert below'})
    ).not.toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(editor).toHaveValue('## ');
  });

  it('renders markdown syntax in place when a text cell is committed', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        detail.id
      }/cells/${detail.cells[0]!.id}/`,
      method: 'PUT',
      body: InvestigationCellFixture({content: '# Hello', version: 2}),
    });
    renderInvestigation(
      InvestigationDetailFixture({
        cells: [InvestigationCellFixture({content: ''})],
      })
    );

    const editor = await screen.findByRole('textbox', {name: 'Text cell 1'});
    await userEvent.type(editor, '# Hello');
    await userEvent.tab();

    expect(screen.getByRole('heading', {name: 'Hello'})).toBeInTheDocument();
  });

  it('inserts a cell between existing cells and persists the new order', async () => {
    const secondCell = InvestigationCellFixture({
      id: 'second-cell',
      position: 1,
    });
    const withTwoCells = InvestigationDetailFixture({
      cells: [detail.cells[0]!, secondCell],
    });
    const insertedCell = InvestigationCellFixture({
      id: 'inserted-cell',
      position: 2,
      content: '',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/`,
      method: 'POST',
      body: insertedCell,
    });
    const reorderRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/order/`,
      method: 'PUT',
      body: {
        ...withTwoCells,
        version: 3,
        cells: [withTwoCells.cells[0]!, insertedCell, secondCell],
      },
    });
    renderInvestigation(withTwoCells);

    await userEvent.click(await screen.findByRole('button', {name: 'Add cell here'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));

    await waitFor(() => expect(reorderRequest).toHaveBeenCalled());
    expect(reorderRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          cellIds: [detail.cells[0]!.id, insertedCell.id, secondCell.id],
        }),
      })
    );
  });

  it('reorders cells through the drag handle', async () => {
    const secondCell = InvestigationCellFixture({
      id: 'second-cell',
      position: 1,
    });
    const withTwoCells = InvestigationDetailFixture({
      cells: [detail.cells[0]!, secondCell],
    });
    const reorderRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/order/`,
      method: 'PUT',
      body: {
        ...withTwoCells,
        version: 2,
        cells: [secondCell, detail.cells[0]!],
      },
    });
    renderInvestigation(withTwoCells);

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
          cellIds: [secondCell.id, detail.cells[0]!.id],
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
