import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import ProjectSourceMaps from 'app/views/settings/projectSourceMaps/list';
import ProjectSourceMapsDetail from 'app/views/settings/projectSourceMaps/detail';

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

  it('renders', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [
        TestStubs.SourceMapArchive(),
        TestStubs.SourceMapArchive({id: 2, name: 'abc'}),
      ],
    });

    const wrapper = mountWithTheme(<ProjectSourceMaps {...props} />);

    const items = wrapper.find('SourceMapsArchiveRow');

    expect(items).toHaveLength(2);
    expect(items.at(0).find('VersionText').text()).toBe('1234');
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    const wrapper = mountWithTheme(<ProjectSourceMaps {...props} />);

    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'There are no archives for this project.'
    );
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

    const wrapper = mountWithTheme(<ProjectSourceMaps {...props} />);

    wrapper.find('button[aria-label="Remove All Artifacts"]').simulate('click');

    // Confirm Modal
    wrapper.find('Modal Button[data-test-id="confirm-button"]').simulate('click');

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

    const wrapper = mountWithTheme(
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

    wrapper
      .find('SearchBar input')
      .simulate('change', {target: {value: 'defg'}})
      .simulate('submit', {preventDefault() {}});

    expect(mockRouter.push).toHaveBeenCalledWith({
      query: {cursor: undefined, query: 'defg'},
    });
  });
});

describe('ProjectSourceMapsDetail', function () {
  const {organization, project, routerContext, router} = initializeOrg({});
  const archiveName = '1234';
  const endpoint = `/projects/${organization.slug}/${project.slug}/releases/${archiveName}/files/`;
  const props = {
    organization,
    project,
    params: {orgId: organization.slug, projectId: project.slug, name: archiveName},
    location: routerContext.context.location,
    router,
  };

  it('renders', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [
        TestStubs.SourceMapArtifact(),
        TestStubs.SourceMapArtifact({name: 'abc', id: '2'}),
      ],
    });

    const wrapper = mountWithTheme(<ProjectSourceMapsDetail {...props} />);

    const items = wrapper.find('SourceMapsArtifactRow');

    expect(items).toHaveLength(2);
    expect(items.at(1).find('Name').text()).toBe('abc');
  });

  it('renders empty', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    const wrapper = mountWithTheme(<ProjectSourceMapsDetail {...props} />);

    expect(wrapper.find('EmptyStateWarning').text()).toBe(
      'There are no artifacts in this archive.'
    );
  });

  it('links to release', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    const wrapper = mountWithTheme(<ProjectSourceMapsDetail {...props} />);

    expect(wrapper.find('Link[aria-label="Go to Release"]').prop('to')).toBe(
      `/organizations/${organization.slug}/releases/${archiveName}/?project=${project.id}`
    );
  });

  it('deletes all artifacts', function () {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });
    const archiveDeleteEndpoint = `/projects/${organization.slug}/${project.slug}/files/source-maps/`;
    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: archiveDeleteEndpoint,
    });

    const wrapper = mountWithTheme(<ProjectSourceMapsDetail {...props} />);

    wrapper.find('button[aria-label="Remove All Artifacts"]').simulate('click');

    // Confirm Modal
    wrapper.find('Modal Button[data-test-id="confirm-button"]').simulate('click');

    expect(deleteMock).toHaveBeenCalledWith(
      archiveDeleteEndpoint,
      expect.objectContaining({
        query: {name: archiveName},
      })
    );
  });

  it('filters artifacts', function () {
    const mockRouter = {push: jest.fn()};
    const mock = MockApiClient.addMockResponse({
      url: endpoint,
      body: [],
    });

    const wrapper = mountWithTheme(
      <ProjectSourceMapsDetail
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

    wrapper
      .find('SearchBar input')
      .simulate('change', {target: {value: 'defg'}})
      .simulate('submit', {preventDefault() {}});

    expect(mockRouter.push).toHaveBeenCalledWith({
      query: {cursor: undefined, query: 'defg'},
    });
  });

  it('deletes single artifact', function () {
    const artifact = TestStubs.SourceMapArtifact();

    MockApiClient.addMockResponse({
      url: endpoint,
      body: [artifact],
    });

    const deleteMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: `${endpoint}${artifact.id}/`,
    });

    const wrapper = mountWithTheme(<ProjectSourceMapsDetail {...props} />);

    wrapper
      .find('SourceMapsArtifactRow button[aria-label="Remove Artifact"]')
      .simulate('click');

    // Confirm Modal
    wrapper.find('Modal Button[data-test-id="confirm-button"]').simulate('click');

    expect(deleteMock).toHaveBeenCalled();
  });
});
