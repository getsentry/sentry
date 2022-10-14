import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ProjectSourceMaps from 'sentry/views/settings/projectSourceMaps/list';

describe('ProjectSourceMaps', function () {
  const {organization, project, routerContext, router} = initializeOrg({});
  const endpoint = `/projects/${organization.slug}/${project.slug}/files/source-maps/`;
  const props = {
    organization,
    project,
    params: {orgId: organization.slug, projectId: project.slug},
    location: routerContext.context.location,
    router,
  };

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [
        TestStubs.SourceMapArchive(),
        TestStubs.SourceMapArchive({id: 2, name: 'abc'}),
      ],
    });

    render(<ProjectSourceMaps {...props} />);

    const rows = screen.getAllByLabelText('Remove All Artifacts');
    expect(rows).toHaveLength(2);

    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    render(<ProjectSourceMaps {...props} />);

    expect(
      screen.getByText('There are no archives for this project.')
    ).toBeInTheDocument();
  });

  it('deletes the archive', function () {
    const archive = TestStubs.SourceMapArchive();

    MockApiClient.addMockResponse({
      url: endpoint,
      body: [archive],
    });

    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: endpoint,
    });

    render(<ProjectSourceMaps {...props} />);
    renderGlobalModal();

    userEvent.click(screen.getByRole('button', {name: 'Remove All Artifacts'}));

    // Confirm Modal
    userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(deleteMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({query: {name: archive.name}})
    );
  });

  it('filters archives', function () {
    const mockRouter = {push: jest.fn()};
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    render(
      <ProjectSourceMaps
        {...props}
        location={{query: {query: 'abc'}}}
        router={mockRouter}
      />
    );

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        query: {query: 'abc'},
      })
    );

    const filterInput = screen.getByPlaceholderText('Filter Archives');
    userEvent.clear(filterInput);
    userEvent.type(filterInput, 'defg{enter}');

    expect(mockRouter.push).toHaveBeenCalledWith({
      query: {cursor: undefined, query: 'defg'},
    });
  });
});
