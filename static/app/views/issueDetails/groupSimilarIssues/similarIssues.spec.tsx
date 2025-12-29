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

import ProjectsStore from 'sentry/stores/projectsStore';
import GroupSimilarIssues from 'sentry/views/issueDetails/groupSimilarIssues/similarIssues';

const MockNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => MockNavigate,
}));
jest.mock('sentry/utils/analytics');

describe('Issues Similar View', () => {
  let mock: jest.Mock;

  const project = ProjectFixture({
    features: ['similarity-view'],
  });

  const group = GroupFixture();
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/org-slug/issues/${group.id}/similar/`,
    },
    route: `/organizations/:orgId/issues/:groupId/similar/`,
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
      url: `/organizations/org-slug/issues/${group.id}/similar/?limit=50`,
      body: mockData.similar,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      body: {features: ['similarity-view']},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'same_root_cause',
        }),
      ],
      body: {data: [], type: 'same_root_cause'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'trace_connected',
        }),
      ],
      body: {data: [], type: 'trace_connected'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/events/latest/`,
      body: {platform: 'python'},
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
    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(await screen.findByText('Show 3 issues below threshold')).toBeInTheDocument();
  });

  it('can merge and redirect to new parent', async () => {
    const merge = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/issues/',
      body: {
        merge: {children: ['123'], parent: '321'},
      },
    });

    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    await userEvent.click(await screen.findByRole('button', {name: 'Merge (1)'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(merge).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/issues/',
        expect.objectContaining({
          data: {merge: 1},
        })
      );
    });

    expect(MockNavigate).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/321/similar/'
    );
  });

  it('correctly shows merge count', async () => {
    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (1)')).toBeInTheDocument();

    // Correctly show "Merge (0)" when the item is un-clicked
    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (0)')).toBeInTheDocument();
  });

  it('shows empty message', async () => {
    mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/similar/?limit=50`,
      body: [],
    });

    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(
      await screen.findByText("There don't seem to be any similar issues.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'This can occur when the issue has no stacktrace or in-app frames.'
      )
    ).not.toBeInTheDocument();
  });
});

describe('Issues Similar Embeddings View', () => {
  let mock: jest.Mock;

  const group = GroupFixture();
  const project = ProjectFixture({
    features: ['similarity-view'],
  });

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/org-slug/issues/${group.id}/similar/`,
    },
    route: `/organizations/:orgId/issues/:groupId/similar/`,
  };

  const similarEmbeddingsScores = [
    {exception: 0.01, shouldBeGrouped: 'Yes'},
    {exception: 0.005, shouldBeGrouped: 'Yes'},
    {exception: 0.7384, shouldBeGrouped: 'No'},
    {exception: 0.3849, shouldBeGrouped: 'No'},
  ];

  const mockData = {
    similarEmbeddings: GroupsFixture().map((issue, i) => [
      issue,
      similarEmbeddingsScores[i],
    ]),
  };

  beforeEach(() => {
    mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/similar-issues-embeddings/?k=10&threshold=0.01&useReranking=true`,
      body: mockData.similarEmbeddings,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/`,
      body: {features: ['similarity-embeddings']},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'same_root_cause',
        }),
      ],
      body: {data: [], type: 'same_root_cause'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/related-issues/`,
      match: [
        MockApiClient.matchQuery({
          type: 'trace_connected',
        }),
      ],
      body: {data: [], type: 'trace_connected'},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/events/latest/`,
      body: {platform: 'python'},
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
    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(screen.queryByText('Show 3 issues below threshold')).not.toBeInTheDocument();
  });

  it('can merge and redirect to new parent', async () => {
    const merge = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/issues/',
      body: {
        merge: {children: ['123'], parent: '321'},
      },
    });

    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    await userEvent.click(await screen.findByRole('button', {name: 'Merge (1)'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(merge).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/issues/',
        expect.objectContaining({
          data: {merge: 1},
        })
      );
    });

    expect(MockNavigate).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/321/similar/'
    );
  });

  it('correctly shows merge count', async () => {
    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (1)')).toBeInTheDocument();

    // Correctly show "Merge (0)" when the item is un-clicked
    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (0)')).toBeInTheDocument();
  });

  it('shows empty message', async () => {
    mock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/similar-issues-embeddings/?k=10&threshold=0.01&useReranking=true`,
      body: [],
    });

    render(<GroupSimilarIssues />, {
      initialRouterConfig,
    });
    renderGlobalModal();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(
      await screen.findByText(
        "There don't seem to be any similar issues. This can occur when the issue has no stacktrace or in-app frames."
      )
    ).toBeInTheDocument();
  });
});
