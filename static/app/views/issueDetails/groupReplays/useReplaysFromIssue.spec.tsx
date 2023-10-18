import {Location} from 'history';
import {Organization} from 'sentry-fixture/organization';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useReplaysFromIssue from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';

jest.mock('sentry/utils/useLocation');

describe('useReplaysFromIssue', () => {
  const location: Location = {
    pathname: '',
    search: '',
    query: {},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  };
  jest.mocked(useLocation).mockReturnValue(location);

  const organization = Organization({
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

  it('should fetch a list of replay ids for a performance issue', async () => {
    const MOCK_GROUP = TestStubs.Group({issueCategory: IssueCategory.PERFORMANCE});

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

  it('queries using start and end date strings if passed in', async () => {
    const MOCK_GROUP = TestStubs.Group();
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        ['mock_transaction']: ['replay42', 'replay256'],
      },
    });
    const mockDate = new Date(Date.now()).toISOString();

    const {waitForNextUpdate} = reactHooks.renderHook(useReplaysFromIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
        datetime: {
          statsPeriod: undefined,
          start: mockDate,
          end: mockDate,
        },
      },
    });

    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: expect.objectContaining({
          start: mockDate,
          end: mockDate,
        }),
      })
    );

    await waitForNextUpdate();
  });

  it('allows for a custom query to be provided and uses a matching key to index the response', async () => {
    const MOCK_GROUP = TestStubs.Group();
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        ['mock_transaction']: ['replay42', 'replay256'],
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysFromIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
        customIdQuery: 'transaction:["mock_transaction"]',
        customIdKey: 'mock_transaction',
      },
    });

    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'transaction:["mock_transaction"]',
        }),
      })
    );

    await waitForNextUpdate();

    expect(result.current).toEqual({
      eventView: expect.objectContaining({
        query: 'id:[replay42,replay256]',
      }),
      fetchError: undefined,
      pageLinks: null,
    });
  });
});
