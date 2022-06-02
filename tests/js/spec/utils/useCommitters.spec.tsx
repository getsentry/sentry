import {reactHooks} from 'sentry-test/reactTestingLibrary';

import CommitterStore from 'sentry/stores/committerStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import useCommitters from 'sentry/utils/useCommitters';

describe('useCommitters hook', function () {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event();
  const group = TestStubs.Group({firstRelease: {}});
  let mockApiEndpoint: ReturnType<typeof MockApiClient.addMockResponse>;

  const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`;

  const mockData = {
    committers: [
      {
        author: TestStubs.CommitAuthor(),
        commits: [TestStubs.Commit()],
      },
    ],
  };

  beforeEach(() => {
    mockApiEndpoint = MockApiClient.addMockResponse({
      url: endpoint,
      body: mockData,
    });

    CommitterStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    CommitterStore.teardown();
    OrganizationStore.teardown();
  });

  it('returns committers', async () => {
    const {result, waitFor} = reactHooks.renderHook(() =>
      useCommitters({group, eventId: event.id, projectSlug: project.slug})
    );

    await waitFor(() => expect(result.current.committers).toEqual(mockData.committers));
    expect(result.current.fetching).toBe(false);
    expect(mockApiEndpoint).toHaveBeenCalledTimes(1);
  });

  it('prevents repeated calls', async () => {
    const {result, waitFor} = reactHooks.renderHook(() =>
      useCommitters({group, eventId: event.id, projectSlug: project.slug})
    );

    await waitFor(() => expect(result.current.committers).toEqual(mockData.committers));

    reactHooks.renderHook(() =>
      useCommitters({group, eventId: event.id, projectSlug: project.slug})
    );
    reactHooks.renderHook(() =>
      useCommitters({group, eventId: event.id, projectSlug: project.slug})
    );

    expect(mockApiEndpoint).toHaveBeenCalledTimes(1);
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
    // Mount and run duplicates
    reactHooks.renderHook(() =>
      useCommitters({group, eventId: event.id, projectSlug: project.slug})
    );
    const {result, waitFor} = reactHooks.renderHook(() =>
      useCommitters({group, eventId: event.id, projectSlug: project.slug})
    );

    await waitFor(() => expect(result.current.committers).toEqual(mockData.committers));

    expect(mockApiEndpoint).toHaveBeenCalledTimes(1);
  });
});
