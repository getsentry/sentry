import {getCommitters} from 'app/actionCreators/committers';
import CommitterActions from 'app/actions/committerActions';
import CommitterStore, {getCommitterStoreKey} from 'app/stores/committerStore';

describe('CommitterActionCreator', function() {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();

  const storeKey = getCommitterStoreKey(organization.slug, project.slug, event.id);
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
  let mockResponse;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockResponse = MockApiClient.addMockResponse({
      url: endpoint,
      body: mockData,
    });

    CommitterStore.init();

    jest.restoreAllMocks();
    jest.spyOn(CommitterActions, 'load');
    jest.spyOn(CommitterActions, 'loadSuccess');

    /**
     * XXX(leedongwei): We would want to ensure that Store methods are not
     * called to be 100% sure that the short-circuit is happening correctly.
     *
     * However, it seems like we cannot attach a listener to the method
     * See: https://github.com/reflux/refluxjs/issues/139#issuecomment-64495623
     */
    // jest.spyOn(CommitterStore, 'load');
    // jest.spyOn(CommitterStore, 'loadSuccess');
  });

  /**
   * XXX(leedongwei): I wanted to separate the ticks and run tests to assert the
   * state change at every tick but it is incredibly flakey.
   */
  it('fetches a Committer and emits actions', async () => {
    getCommitters(api, {
      orgSlug: organization.slug,
      projectSlug: project.slug,
      eventId: event.id,
    }); // Fire Action.load
    expect(CommitterActions.load).toHaveBeenCalledWith(
      organization.slug,
      project.slug,
      event.id
    );
    expect(CommitterActions.loadSuccess).not.toHaveBeenCalled();

    await tick(); // Run Store.load and fire Action.loadSuccess
    await tick(); // Run Store.loadSuccess

    expect(mockResponse).toHaveBeenCalledWith(endpoint, expect.anything());
    expect(CommitterActions.loadSuccess).toHaveBeenCalledWith(
      organization.slug,
      project.slug,
      event.id,
      mockData.committers
    );

    expect(CommitterStore.state).toEqual({
      [storeKey]: {
        committers: mockData.committers,
        committersLoading: false,
        committersError: undefined,
      },
    });
  });

  it('short-circuits the JS event loop', async () => {
    expect(CommitterStore.state.committersLoading).toEqual(undefined);

    getCommitters(api, {
      orgSlug: organization.slug,
      projectSlug: project.slug,
      eventId: event.id,
    }); // Fire Action.load

    expect(CommitterActions.load).toHaveBeenCalled();
    // expect(CommitterStore.load).not.toHaveBeenCalled();
    expect(CommitterStore.state[storeKey].committersLoading).toEqual(true); // Short-circuit
  });
});
