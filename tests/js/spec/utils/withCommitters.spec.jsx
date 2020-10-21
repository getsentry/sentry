import {mount} from 'sentry-test/enzyme';

import CommitterStore from 'app/stores/committerStore';
import withCommitters from 'app/utils/withCommitters';

describe('withCommitters HoC', function () {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();
  const group = TestStubs.Group({firstRelease: {}});

  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`;

  const api = new MockApiClient();
  const mockData = {
    committers: [
      {
        author: TestStubs.CommitAuthor(),
        commits: [TestStubs.Commit()],
      },
    ],
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: endpoint,
      body: mockData,
    });

    jest.restoreAllMocks();
    CommitterStore.init();
  });

  it('adds committers prop', async () => {
    const Component = () => null;
    const Container = withCommitters(Component);
    const wrapper = mount(
      <Container
        api={api}
        organization={organization}
        project={project}
        event={event}
        group={group}
      />
    );

    await tick(); // Run Store.load
    await tick(); // Run Store.loadSuccess
    wrapper.update(); // Re-render component with Store data

    const mountedComponent = wrapper.find(Component);
    expect(mountedComponent.prop('committers')).toEqual(mockData.committers);
    expect(mountedComponent.prop('committersLoading')).toEqual(undefined);
    expect(mountedComponent.prop('committersError')).toEqual(undefined);
  });

  it('prevents repeated calls', async () => {
    const Component = () => null;
    const Container = withCommitters(Component);

    // XXX(leedongwei): We cannot spy on `fetchCommitters` as Jest can't
    // replace the method in the prototype due to createReactClass.
    // As such, I'm using `componentDidMount` as a proxy.
    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'componentDidMount');
    // jest.spyOn(Container.prototype, 'fetchCommitters');

    // Mount and run component
    mount(
      <Container
        api={api}
        organization={organization}
        project={project}
        event={event}
        group={group}
      />
    );
    await tick();
    await tick();

    // Mount and run duplicates
    mount(
      <Container
        api={api}
        organization={organization}
        project={project}
        event={event}
        group={group}
      />
    );
    await tick();
    mount(
      <Container
        api={api}
        organization={organization}
        project={project}
        event={event}
        group={group}
      />
    );
    await tick();

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.componentDidMount).toHaveBeenCalledTimes(3);
    // expect(Container.prototype.fetchCommitters).toHaveBeenCalledTimes(3);
  });

  /**
   * Same as 'prevents repeated calls', but with the async fetch/checks
   * happening on same tick.
   *
   * Additionally, this test checks that withCommitters.fetchCommitters does
   * not check for (store.orgSlug !== orgSlug) as the short-circuit does not
   * change the value for orgSlug
   */
  it('prevents simultaneous calls', async () => {
    const Component = () => null;
    const Container = withCommitters(Component);

    jest.spyOn(api, 'requestPromise');
    jest.spyOn(Container.prototype, 'componentDidMount');

    // Mount and run duplicates
    mount(
      <Container
        api={api}
        organization={organization}
        project={project}
        event={event}
        group={group}
      />
    );
    mount(
      <Container
        api={api}
        organization={organization}
        project={project}
        event={event}
        group={group}
      />
    );
    mount(
      <Container
        api={api}
        organization={organization}
        project={project}
        event={event}
        group={group}
      />
    );

    await tick();
    await tick();

    expect(api.requestPromise).toHaveBeenCalledTimes(1);
    expect(Container.prototype.componentDidMount).toHaveBeenCalledTimes(3);
  });
});
