import {GroupsFixture} from 'sentry-fixture/groups';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';
import GroupSimilarIssues from 'sentry/views/issueDetails/groupSimilarIssues';

const MockNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => MockNavigate,
}));
jest.mock('sentry/utils/analytics');

describe('Issues Similar View', function () {
  let mock;

  const project = ProjectFixture({
    features: ['similarity-view'],
  });

  const router = RouterFixture({
    params: {orgId: 'org-slug', projectId: 'project-slug', groupId: 'group-id'},
  });

  const scores = [
    {'exception:stacktrace:pairs': 0.375},
    {'exception:stacktrace:pairs': 0.01264},
    {'exception:stacktrace:pairs': 0.875},
    {'exception:stacktrace:pairs': 0.001488},
  ];

  const mockData = {
    similar: GroupsFixture().map((issue, i) => [issue, scores[i]]),
  };

  beforeEach(function () {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/similar/?limit=50',
      body: mockData.similar,
    });
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

  it('renders with mocked data', async function () {
    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(await screen.findByText('Show 3 issues below threshold')).toBeInTheDocument();
  });

  it('can merge and redirect to new parent', async function () {
    const merge = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/issues/',
      body: {
        merge: {children: ['123'], parent: '321'},
      },
    });

    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );
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

  it('correctly shows merge count', async function () {
    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );
    renderGlobalModal();

    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (1)')).toBeInTheDocument();

    // Correctly show "Merge (0)" when the item is un-clicked
    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (0)')).toBeInTheDocument();
  });

  it('shows empty message', async function () {
    // Manually clear responses and add an empty response
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/similar/?limit=50',
      body: [],
    });

    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );
    renderGlobalModal();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

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

describe('Issues Similar Embeddings View', function () {
  let mock;

  const project = ProjectFixture({
    features: ['similarity-view', 'similarity-embeddings'],
  });

  const router = RouterFixture({
    params: {orgId: 'org-slug', projectId: 'project-slug', groupId: 'group-id'},
  });

  const similarEmbeddingsScores = [
    {exception: 0.01, message: 0.3748, shouldBeGrouped: 'Yes'},
    {exception: 0.005, message: 0.3738, shouldBeGrouped: 'Yes'},
    {exception: 0.7384, message: 0.3743, shouldBeGrouped: 'No'},
    {exception: 0.3849, message: 0.4738, shouldBeGrouped: 'No'},
  ];

  const mockData = {
    simlarEmbeddings: GroupsFixture().map((issue, i) => [
      issue,
      similarEmbeddingsScores[i],
    ]),
  };

  beforeEach(function () {
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/similar-issues-embeddings/?k=10&threshold=0.01&useReranking=true',
      body: mockData.simlarEmbeddings,
    });
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

  it('renders with mocked data', async function () {
    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(await screen.findByText('Would Group')).toBeInTheDocument();
    expect(screen.queryByText('Show 3 issues below threshold')).not.toBeInTheDocument();
  });

  it('can merge and redirect to new parent', async function () {
    const merge = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/issues/',
      body: {
        merge: {children: ['123'], parent: '321'},
      },
    });

    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );
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

  it('correctly shows merge count', async function () {
    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );
    renderGlobalModal();

    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (1)')).toBeInTheDocument();

    // Correctly show "Merge (0)" when the item is un-clicked
    await selectNthSimilarItem(0);
    expect(screen.getByText('Merge (0)')).toBeInTheDocument();
  });

  it('sends issue similarity embeddings agree analytics', async function () {
    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );
    renderGlobalModal();

    await selectNthSimilarItem(0);
    await userEvent.click(await screen.findByRole('button', {name: 'Agree (1)'}));
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue_details.similar_issues.similarity_embeddings_feedback_recieved',
      expect.objectContaining({
        projectId: project.id,
        groupId: 'group-id',
        value: 'Yes',
        wouldGroup: similarEmbeddingsScores[0].shouldBeGrouped,
      })
    );
  });

  it('shows empty message', async function () {
    // Manually clear responses and add an empty response
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/similar-issues-embeddings/?k=10&threshold=0.01&useReranking=true',
      body: [],
    });

    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
      />,
      {router}
    );
    renderGlobalModal();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await waitFor(() => expect(mock).toHaveBeenCalled());

    expect(
      await screen.findByText(
        "There don't seem to be any similar issues. This can occur when the issue has no stacktrace or in-app frames."
      )
    ).toBeInTheDocument();
  });
});
