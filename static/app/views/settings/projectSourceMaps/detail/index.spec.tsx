import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectSourceMapsDetail from 'sentry/views/settings/projectSourceMaps/detail';

describe('ProjectSourceMapsDetail', () => {
  const {organization, project, routerContext, router} = initializeOrg({});
  const archiveName = '1234';
  const endpoint = `/projects/${organization.slug}/${project.slug}/releases/${archiveName}/files/`;
  const props = {
    organization,
    project,
    params: {projectId: project.slug, name: archiveName},
    location: routerContext.context.location,
    router,
    route: router.routes[0],
    routes: router.routes,
    routeParams: router.params,
  };

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [
        TestStubs.SourceMapArtifact(),
        TestStubs.SourceMapArtifact({name: 'abc', id: '2'}),
      ],
    });

    render(<ProjectSourceMapsDetail {...props} />);

    const items = screen.getAllByRole('button', {name: 'Remove Artifact'});

    expect(items).toHaveLength(2);
    expect(screen.getByText('abc')).toBeInTheDocument();
  });

  it('renders empty', () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    render(<ProjectSourceMapsDetail {...props} />);

    expect(
      screen.getByText('There are no artifacts in this archive.')
    ).toBeInTheDocument();
  });

  it('links to release', () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    render(<ProjectSourceMapsDetail {...props} />, {context: routerContext});
    expect(screen.getByRole('button', {name: 'Go to Release'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/releases/${archiveName}/?project=${project.id}`
    );
  });

  it('deletes all artifacts', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });
    const archiveDeleteEndpoint = `/projects/${organization.slug}/${project.slug}/files/source-maps/`;
    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: archiveDeleteEndpoint,
    });

    render(<ProjectSourceMapsDetail {...props} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Remove All Artifacts'}));

    // Confirm Modal
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(deleteMock).toHaveBeenCalledWith(
      archiveDeleteEndpoint,
      expect.objectContaining({
        query: {name: archiveName},
      })
    );
  });

  it('filters artifacts', async () => {
    const spy = jest.spyOn(router, 'push');
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    render(
      <ProjectSourceMapsDetail
        {...props}
        location={{...props.location, query: {query: 'abc'}}}
      />
    );

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        query: {query: 'abc'},
      })
    );

    const filterInput = screen.getByPlaceholderText('Filter artifacts');
    await userEvent.clear(filterInput);
    await userEvent.type(filterInput, 'defg{enter}');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {cursor: undefined, query: 'defg'},
      })
    );
  });

  it('deletes single artifact', async () => {
    const artifact = TestStubs.SourceMapArtifact();

    MockApiClient.addMockResponse({
      url: endpoint,
      body: [artifact],
    });

    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `${endpoint}${artifact.id}/`,
    });

    render(<ProjectSourceMapsDetail {...props} />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Remove Artifact'}));

    // Confirm Modal
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(deleteMock).toHaveBeenCalled();
  });
});
