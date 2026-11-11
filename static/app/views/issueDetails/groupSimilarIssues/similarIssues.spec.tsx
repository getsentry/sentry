import {GroupFixture} from 'sentry-fixture/group';
import {GroupsFixture} from 'sentry-fixture/groups';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {GroupIdProvider} from 'sentry/views/issueDetails/groupIdContext';

import {GroupSimilarIssues} from './similarIssues';

jest.mock('sentry/utils/analytics');

function GroupSimilarIssuesWithProvider({groupId}: {groupId: string}) {
  return (
    <GroupIdProvider groupId={groupId}>
      <GroupSimilarIssues />
    </GroupIdProvider>
  );
}

function mockNoSameTraceIssues(groupId: string) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${groupId}/related/`,
    match: [MockApiClient.matchQuery({type: ['same_trace']})],
    body: {data: [], meta: {types: [{type: 'same_trace', status: 'ok'}]}},
  });
}

function mockRedirectedGroup(project: Project, useEmbeddings = false) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/321/',
    body: GroupFixture({id: '321', project}),
  });
  if (useEmbeddings) {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/321/related/',
      match: [MockApiClient.matchQuery({type: ['similar_stacktrace']})],
      body: {data: [], meta: {types: [{type: 'similar_stacktrace', status: 'ok'}]}},
    });
  } else {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/321/similar/',
      body: [],
    });
  }
  mockNoSameTraceIssues('321');
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/321/tags/',
    body: [],
  });
}

describe('Issues Similar View', () => {
  let mock: jest.Mock;

  const project = ProjectFixture({
    features: ['similarity-view'],
  });

  const group = GroupFixture({project});
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/org-slug/issues/${group.id}/similar/`,
    },
    route: '/organizations/:orgId/issues/:groupId/similar/',
  };

  const scores = [
    {'exception:stacktrace:pairs': 0.375},
    {'exception:stacktrace:pairs': 0.01264},
    {'exception:stacktrace:pairs': 0.875},
    {'exception:stacktrace:pairs': 0.001488},
  ];

  const mockData = {
    similar: GroupsFixture().map((issue, i) => [issue, scores[i]]),
  };

  beforeEach(() => {
    mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/similar/`,
      body: mockData.similar,
      match: [MockApiClient.matchQuery({limit: 50})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: {features: ['similarity-view']},
    });
    mockNoSameTraceIssues(group.id);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const selectNthSimilarItem = async (index: number) => {
    const items = await screen.findAllByTestId('similar-item-row');

    const item = items.at(index);

    expect(item).toBeDefined();

    await userEvent.click(item!);
  };

  it('renders with mocked data', async () => {
    render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(await screen.findByText('Show 3 issues below threshold')).toBeInTheDocument();
  });

  it('can merge and redirect to new parent', async () => {
    mockRedirectedGroup(project);
    const merge = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/issues/',
      body: {
        merge: {children: ['123'], parent: '321'},
      },
    });

    const {router} = render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    await userEvent.click(await screen.findByRole('button', {name: 'Merge 1 issue'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(merge).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/issues/',
        expect.objectContaining({
          data: {merge: 1},
          query: {id: expect.arrayContaining([group.id])},
        })
      );
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/321/');
    });
    expect(router.location.query).toEqual({drawer: 'similar'});
  });

  it('toggles selection when item is clicked', async () => {
    render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    const checkbox = screen.getAllByRole('checkbox')[0]!;
    expect(checkbox).toBeChecked();

    await selectNthSimilarItem(0);
    expect(checkbox).not.toBeChecked();
  });

  it('shows empty message', async () => {
    mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/similar/`,
      body: [],
      match: [MockApiClient.matchQuery({limit: 50})],
    });

    render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(await screen.findByText('No similar issues found.')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'This can happen when the issue has no stacktrace or in-app frames.'
      )
    ).not.toBeInTheDocument();
  });
});

describe('Issues Similar Embeddings View', () => {
  let mock: jest.Mock;

  const project = ProjectFixture({
    features: ['similarity-view'],
  });
  const group = GroupFixture({project});

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/org-slug/issues/${group.id}/similar/`,
    },
    route: '/organizations/:orgId/issues/:groupId/similar/',
  };

  const scores = [0.99, 0.95, 0.9, 0.85];

  const similarStacktraceResponse = {
    data: GroupsFixture().map((issue, i) => ({
      issue,
      relations: [{type: 'similar_stacktrace', score: scores[i]}],
    })),
    meta: {types: [{type: 'similar_stacktrace', status: 'ok'}]},
  };

  beforeEach(() => {
    mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related/`,
      body: similarStacktraceResponse,
      match: [MockApiClient.matchQuery({type: ['similar_stacktrace']})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: {features: ['similarity-embeddings']},
    });
    mockNoSameTraceIssues(group.id);
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const selectNthSimilarItem = async (index: number) => {
    const items = await screen.findAllByTestId('similar-item-row');

    const item = items.at(index);

    expect(item).toBeDefined();

    await userEvent.click(item!);
  };

  it('renders with mocked data', async () => {
    render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });

    expect(await screen.findAllByTestId('similar-item-row')).toHaveLength(4);
    expect(mock).toHaveBeenCalled();
    expect(screen.queryByText('Show 3 issues below threshold')).not.toBeInTheDocument();
  });

  it('can merge and redirect to new parent', async () => {
    mockRedirectedGroup(project, true);
    const merge = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/issues/',
      body: {
        merge: {children: ['123'], parent: '321'},
      },
    });

    const {router} = render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    await userEvent.click(await screen.findByRole('button', {name: 'Merge 1 issue'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(merge).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/issues/',
        expect.objectContaining({
          data: {merge: 1},
          query: {id: expect.arrayContaining([group.id])},
        })
      );
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/321/');
    });
    expect(router.location.query).toEqual({drawer: 'similar'});
  });

  it('toggles selection when item is clicked', async () => {
    render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    const checkbox = screen.getAllByRole('checkbox')[0]!;
    expect(checkbox).toBeChecked();

    await selectNthSimilarItem(0);
    expect(checkbox).not.toBeChecked();
  });

  it('shows empty message', async () => {
    mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related/`,
      body: {
        data: [],
        meta: {
          types: [
            {
              type: 'similar_stacktrace',
              status: 'not_applicable',
              detail: "This issue's event has no stack trace Seer can compare.",
            },
          ],
        },
      },
      match: [MockApiClient.matchQuery({type: ['similar_stacktrace']})],
    });

    render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(
      await screen.findByText(
        'No similar issues found. This can happen when the issue has no stacktrace or in-app frames.'
      )
    ).toBeInTheDocument();
  });

  it('shows an error and retries when similar issues are unavailable', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related/`,
      statusCode: 503,
      body: {detail: 'Related issues are temporarily unavailable. Try again later.'},
      match: [MockApiClient.matchQuery({type: ['similar_stacktrace']})],
    });

    render(<GroupSimilarIssuesWithProvider groupId={group.id} />, {
      initialRouterConfig,
    });

    expect(await screen.findByText("Couldn't load similar issues.")).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related/`,
      body: similarStacktraceResponse,
      match: [MockApiClient.matchQuery({type: ['similar_stacktrace']})],
    });
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(await screen.findAllByTestId('similar-item-row')).toHaveLength(4);
  });
});
