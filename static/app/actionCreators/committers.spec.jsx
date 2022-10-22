import {Commit} from 'fixtures/js-stubs/commit';
import {CommitAuthor} from 'fixtures/js-stubs/commitAuthor';
import {Event} from 'fixtures/js-stubs/event';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';

import {getCommitters} from 'sentry/actionCreators/committers';
import CommitterStore, {getCommitterStoreKey} from 'sentry/stores/committerStore';

describe('CommitterActionCreator', function () {
  const organization = Organization();
  const project = Project();
  const event = Event();

  const storeKey = getCommitterStoreKey(organization.slug, project.slug, event.id);
  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`;

  const api = new MockApiClient();
  const mockData = {
    committers: [
      {
        author: CommitAuthor(),
        commits: [Commit()],
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
    jest.spyOn(CommitterStore, 'load');
    jest.spyOn(CommitterStore, 'loadSuccess');

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
    expect(CommitterStore.load).toHaveBeenCalledWith(
      organization.slug,
      project.slug,
      event.id
    );
    expect(CommitterStore.loadSuccess).not.toHaveBeenCalled();

    await tick(); // Run Store.load and fire Action.loadSuccess
    await tick(); // Run Store.loadSuccess

    expect(mockResponse).toHaveBeenCalledWith(endpoint, expect.anything());
    expect(CommitterStore.loadSuccess).toHaveBeenCalledWith(
      organization.slug,
      project.slug,
      event.id,
      mockData.committers,
      undefined
    );

    expect(CommitterStore.state).toEqual({
      [storeKey]: {
        committers: mockData.committers,
        committersLoading: false,
        committersError: undefined,
      },
    });
  });

  it('short-circuits the JS event loop', () => {
    expect(CommitterStore.state.committersLoading).toEqual(undefined);

    getCommitters(api, {
      orgSlug: organization.slug,
      projectSlug: project.slug,
      eventId: event.id,
    }); // Fire Action.load

    expect(CommitterStore.load).toHaveBeenCalled();
    // expect(CommitterStore.load).not.toHaveBeenCalled();
    expect(CommitterStore.state[storeKey].committersLoading).toEqual(true); // Short-circuit
  });
});
