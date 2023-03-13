import {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useReplaysFromIssue from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';

jest.mock('sentry/utils/useLocation');

describe('useReplaysFromIssue', () => {
  const MockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

  const location = {
    pathname: '',
    search: '',
    query: {},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  } as Location;
  MockUseLocation.mockReturnValue(location);

  const organization = TestStubs.Organization({
    features: ['session-replay'],
  });

  it('should fetch a list of replay ids', async () => {
    const MOCK_GROUP = TestStubs.Group();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        [MOCK_GROUP.id]: ['replay42', 'replay256'],
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysFromIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
      },
    });

    expect(result.current).toEqual({
      eventView: null,
      fetchError: undefined,
      pageLinks: null,
    });

    await waitForNextUpdate();

    expect(result.current).toEqual({
      eventView: expect.objectContaining({
        query: 'id:[replay42,replay256]',
      }),
      fetchError: undefined,
      pageLinks: null,
    });
  });

  it('should return an empty EventView when there are no replay_ids returned from the count endpoint', async () => {
    const MOCK_GROUP = TestStubs.Group();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysFromIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
      },
    });

    expect(result.current).toEqual({
      eventView: null,
      fetchError: undefined,
      pageLinks: null,
    });

    await waitForNextUpdate();

    expect(result.current).toEqual({
      eventView: expect.objectContaining({
        query: 'id:[]',
      }),
      fetchError: undefined,
      pageLinks: null,
    });
  });
});
