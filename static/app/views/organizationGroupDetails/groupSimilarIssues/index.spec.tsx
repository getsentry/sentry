import {browserHistory} from 'react-router';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import GroupSimilarIssues from 'sentry/views/organizationGroupDetails/groupSimilarIssues';

describe('Issues Similar View', function () {
  let mock;

  const project = TestStubs.Project({
    features: ['similarity-view'],
  });

  const routerContext = TestStubs.routerContext([
    {
      router: {
        ...TestStubs.router(),
        params: {orgId: 'org-slug', projectId: 'project-slug', groupId: 'group-id'},
      },
    },
  ]);

  const scores = [
    {'exception:stacktrace:pairs': 0.375},
    {'exception:stacktrace:pairs': 0.01264},
    {'exception:stacktrace:pairs': 0.875},
    {'exception:stacktrace:pairs': 0.001488},
  ];

  const mockData = {
    similar: TestStubs.Groups().map((issue, i) => [issue, scores[i]]),
  };

  const router = TestStubs.router();

  beforeEach(function () {
    mock = MockApiClient.addMockResponse({
      url: '/issues/group-id/similar/?limit=50&version=1',
      body: mockData.similar,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders initially with loading component', function () {
    render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
        router={router}
        routeParams={router.params}
        routes={router.routes}
        route={{}}
      />,
      {context: routerContext}
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders with mocked data', async function () {
    const wrapper = render(
      <GroupSimilarIssues
        project={project}
        params={{orgId: 'org-slug', groupId: 'group-id'}}
        location={router.location}
        router={router}
        routeParams={router.params}
        routes={router.routes}
        route={{}}
      />,
      {context: routerContext}
    );

    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(wrapper.container).toSnapshot();
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
        router={router}
        routeParams={router.params}
        routes={router.routes}
        route={{}}
      />,
      {context: routerContext}
    );
    renderGlobalModal();

    userEvent.click(await screen.findByTestId('similar-item-row'));
    userEvent.click(await screen.findByRole('button', {name: 'Merge (1)'}));
    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    await waitFor(() => {
      expect(merge).toHaveBeenCalledWith(
        '/projects/org-slug/project-slug/issues/',
        expect.objectContaining({
          data: {merge: 1},
        })
      );
    });

    expect(browserHistory.push).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/321/similar/'
    );
  });
});
