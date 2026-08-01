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
  const organization = OrganizationFixture({features: ['investigations']});
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

  function renderInvestigation(response = detail) {
    MockApiClient.addMockResponse({url: detailUrl, body: response});
    return render(
      <TopBar.Slot.Provider>
        <TopBar />
        <SeerInvestigation />
      </TopBar.Slot.Provider>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/organizations/${organization.slug}/seer/${detail.id}/`},
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
    const title = await screen.findByRole('textbox', {name: 'Investigation name'});
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
    const queryEditor = await screen.findByRole('textbox', {name: 'Query cell 2'});
    expect(queryEditor).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Run'})).toBeDisabled();

    const suggestion = 'Show errors over time for the selected projects';
    await userEvent.click(screen.getByRole('button', {name: 'see an example'}));
    expect(queryEditor).not.toHaveValue(suggestion);
    await waitFor(() => expect(queryEditor).toHaveValue(suggestion), {timeout: 2000});
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
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/${
        withComments.cells[0]!.id
      }/comments/`,
      body: [InvestigationCommentFixture()],
    });
    renderInvestigation(withComments);

    await userEvent.click(await screen.findByRole('button', {name: 'Comments, 1'}));

    expect(await screen.findByText('I can reproduce this.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Add a comment'})).toBeInTheDocument();
  });

  it('expands reactions in place as an icon-only picker', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/${detail.cells[0]!.id}/comments/`,
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
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/${
        readOnly.cells[0]!.id
      }/comments/`,
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
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/${detail.cells[0]!.id}/`,
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
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/${detail.cells[0]!.id}/`,
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
    const secondCell = InvestigationCellFixture({id: 'second-cell', position: 1});
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
    const secondCell = InvestigationCellFixture({id: 'second-cell', position: 1});
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
    const title = await screen.findByRole('textbox', {name: 'Investigation name'});
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
