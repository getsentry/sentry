import {reactHooks} from 'sentry-test/reactTestingLibrary';

import CommitterStore from 'sentry/stores/committerStore';
import useCommitters from 'sentry/utils/useCommitters';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('useCommitters hook', function () {
  const organization = TestStubs.Organization();
  const wrapper = ({children}: {children?: React.ReactNode}) => (
    <OrganizationContext.Provider value={organization}>
      {children}
    </OrganizationContext.Provider>
  );
  const project = TestStubs.Project();
  const event = TestStubs.Event();
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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('returns committers', async () => {
    const {result, waitFor} = reactHooks.renderHook(useCommitters, {
      initialProps: {eventId: event.id, projectSlug: project.slug},
      wrapper,
    });

    await waitFor(() => expect(result.current.committers).toEqual(mockData.committers));
    expect(result.current.fetching).toBe(false);
    expect(mockApiEndpoint).toHaveBeenCalledTimes(1);
  });

  it('prevents repeated calls', async () => {
    const {result, waitFor} = reactHooks.renderHook(useCommitters, {
      initialProps: {eventId: event.id, projectSlug: project.slug},
      wrapper,
    });

    await waitFor(() => expect(result.current.committers).toEqual(mockData.committers));

    reactHooks.renderHook(useCommitters, {
      initialProps: {eventId: event.id, projectSlug: project.slug},
      wrapper,
    });
    reactHooks.renderHook(useCommitters, {
      initialProps: {eventId: event.id, projectSlug: project.slug},
      wrapper,
    });

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
    reactHooks.renderHook(useCommitters, {
      initialProps: {eventId: event.id, projectSlug: project.slug},
      wrapper,
    });
    const {result, waitFor} = reactHooks.renderHook(useCommitters, {
      initialProps: {eventId: event.id, projectSlug: project.slug},
      wrapper,
    });

    await waitFor(() => expect(result.current.committers).toEqual(mockData.committers));

    expect(mockApiEndpoint).toHaveBeenCalledTimes(1);
  });
});
