import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';

import useReplaysCount from './useReplaysCount';

jest.mock('sentry/utils/useLocation');

describe('useReplaysCount', () => {
  const MockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

  const mockGroupIds = ['123', '456'];
  const mockTransactionNames = ['/home', '/profile'];

  MockUseLocation.mockReturnValue({
    pathname: '',
    search: '',
    query: {},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  const organization = TestStubs.Organization({
    features: ['session-replay-ui'],
  });
  const project = TestStubs.Project({
    platform: 'javascript',
  });
  const projectIds = [Number(project.id)];

  it('should throw if neither groupIds nor transactionNames is provided', () => {
    const {result} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
      },
    });
    expect(result.error).toBeTruthy();
  });

  it('should throw if both groupIds and transactionNames are provided', () => {
    const {result} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
        groupIds: [],
        transactionNames: [],
      },
    });
    expect(result.error).toBeTruthy();
  });

  it('should query for groupIds', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issue-replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
        groupIds: mockGroupIds,
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issue-replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[${mockGroupIds.join(',')}]`,
          statsPeriod: '14d',
          project: [2],
        },
      })
    );

    await waitForNextUpdate();
  });

  it('should return the count of each groupId, or zero if not included in the response', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issue-replay-count/`,
      method: 'GET',
      body: {
        123: 42,
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
        groupIds: mockGroupIds,
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalled();

    await waitForNextUpdate();

    expect(result.current).toEqual({
      '123': 42,
      '456': 0,
    });
  });

  it('should request the count for a group only once', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issue-replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, rerender, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
        groupIds: mockGroupIds,
      },
    });

    await waitForNextUpdate();

    expect(replayCountRequest).toHaveBeenCalledTimes(1);
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issue-replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[123,456]`,
          statsPeriod: '14d',
          project: [2],
        },
      })
    );
    expect(result.current).toEqual({
      123: 0,
      456: 0,
    });

    rerender({
      organization,
      projectIds,
      groupIds: [...mockGroupIds, '789'],
    });

    await waitForNextUpdate();

    expect(replayCountRequest).toHaveBeenCalledTimes(2);
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issue-replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[789]`,
          statsPeriod: '14d',
          project: [2],
        },
      })
    );
    expect(result.current).toEqual({
      123: 0,
      456: 0,
      789: 0,
    });
  });

  it('should not request anything if there are no new ids to query', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issue-replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, rerender, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
        groupIds: mockGroupIds,
      },
    });

    await waitForNextUpdate();

    expect(replayCountRequest).toHaveBeenCalledTimes(1);
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issue-replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[123,456]`,
          statsPeriod: '14d',
          project: [2],
        },
      })
    );
    expect(result.current).toEqual({
      123: 0,
      456: 0,
    });

    rerender({
      organization,
      projectIds,
      groupIds: mockGroupIds,
    });

    expect(replayCountRequest).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      123: 0,
      456: 0,
    });
  });

  it('should query for transactionNames', async () => {
    const countRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
        transactionNames: mockTransactionNames,
      },
    });

    expect(result.current).toEqual({});
    expect(countRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: {
          environment: [],
          field: ['count_unique(replayId)', 'transaction'],
          per_page: 50,
          project: [String(project.id)],
          query: `!replayId:"" event.type:transaction transaction:[${mockTransactionNames.join(
            ','
          )}]`,
          statsPeriod: '14d',
        },
      })
    );

    await waitForNextUpdate();
  });

  it('should return the count of each transactionName, or zero if not included in the response', async () => {
    const countRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'count_unique(replayId)': 42,
            transaction: '/home',
          },
        ],
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        projectIds,
        transactionNames: mockTransactionNames,
      },
    });

    expect(result.current).toEqual({});
    expect(countRequest).toHaveBeenCalled();

    await waitForNextUpdate();

    expect(result.current).toEqual({
      '/home': 42,
      '/profile': 0,
    });
  });
});
