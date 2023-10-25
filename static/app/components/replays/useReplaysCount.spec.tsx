import {ReactNode} from 'react';
import {Organization} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {IssueCategory} from 'sentry/types';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';

import useReplaysCount from './useReplaysCount';

jest.mock('sentry/utils/useLocation');

function wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useReplaysCount', () => {
  const mockGroupIds = ['123', '456'];
  const mockReplayIds = ['abc', 'def'];
  const mockTransactionNames = ['/home', '/profile'];

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  const organization = Organization({
    features: ['session-replay'],
  });

  it('should throw if none of groupIds, replayIds, transactionNames is provided', () => {
    const {result} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
      },
    });
    expect(result.error).toBeTruthy();
  });

  it('should throw if more than one of groupIds, replayIds, transactionNames are provided', () => {
    const {result: result1} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        groupIds: [],
        transactionNames: [],
      },
    });
    expect(result1.error).toBeTruthy();

    const {result: result2} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        groupIds: [],
        replayIds: [],
      },
    });
    expect(result2.error).toBeTruthy();

    const {result: result3} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        replayIds: [],
        transactionNames: [],
      },
    });
    expect(result3.error).toBeTruthy();
  });

  it('should query for groupIds', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        groupIds: mockGroupIds,
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[${mockGroupIds.join(',')}]`,
          data_source: 'discover',
          statsPeriod: '14d',
          project: -1,
        },
      })
    );

    await waitForNextUpdate();
  });

  it('should query for groupIds on performance issues', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        issueCategory: IssueCategory.PERFORMANCE,
        groupIds: mockGroupIds,
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[${mockGroupIds.join(',')}]`,
          data_source: 'search_issues',
          statsPeriod: '14d',
          project: -1,
        },
      })
    );

    await waitForNextUpdate();
  });

  it('should return the count of each groupId, or zero if not included in the response', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        123: 42,
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
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
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, rerender, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        groupIds: mockGroupIds,
      },
    });

    await waitForNextUpdate();

    expect(replayCountRequest).toHaveBeenCalledTimes(1);
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[123,456]`,
          data_source: 'discover',
          statsPeriod: '14d',
          project: -1,
        },
      })
    );
    expect(result.current).toEqual({
      123: 0,
      456: 0,
    });

    rerender({
      organization,
      groupIds: [...mockGroupIds, '789'],
    });

    await waitForNextUpdate();

    expect(replayCountRequest).toHaveBeenCalledTimes(2);
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[789]`,
          data_source: 'discover',
          statsPeriod: '14d',
          project: -1,
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
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, rerender, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        groupIds: mockGroupIds,
      },
    });

    await waitForNextUpdate();

    expect(replayCountRequest).toHaveBeenCalledTimes(1);
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `issue.id:[123,456]`,
          data_source: 'discover',
          statsPeriod: '14d',
          project: -1,
        },
      })
    );
    expect(result.current).toEqual({
      123: 0,
      456: 0,
    });

    rerender({
      organization,
      groupIds: mockGroupIds,
    });

    expect(replayCountRequest).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      123: 0,
      456: 0,
    });
  });

  it('should query for replayId', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        replayIds: mockReplayIds,
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `replay_id:[abc,def]`,
          data_source: 'discover',
          statsPeriod: '14d',
          project: -1,
        },
      })
    );

    await waitForNextUpdate();
  });

  it('should return the count of each replayId, or zero if not included in the response', async () => {
    const countRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        abc: 42,
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        replayIds: mockReplayIds,
      },
    });

    expect(result.current).toEqual({});
    expect(countRequest).toHaveBeenCalled();

    await waitForNextUpdate();

    expect(result.current).toEqual({
      abc: 42,
      def: 0,
    });
  });

  it('should query for transactionNames', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        transactionNames: mockTransactionNames,
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `transaction:["/home","/profile"]`,
          data_source: 'discover',
          statsPeriod: '14d',
          project: -1,
        },
      })
    );

    await waitForNextUpdate();
  });

  it('should return the count of each transactionName, or zero if not included in the response', async () => {
    const countRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        '/home': 42,
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
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

  it('should accept start and end times and override statsPeriod', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });
    const mockDate = new Date(Date.now());

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        transactionNames: mockTransactionNames,
        datetime: {
          start: mockDate,
          end: mockDate,
        },
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `transaction:["/home","/profile"]`,
          data_source: 'discover',
          project: -1,
          start: mockDate,
          end: mockDate,
        },
      })
    );

    await waitForNextUpdate();
  });

  it('passes along extra conditions and appends them to the query', async () => {
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      wrapper,
      initialProps: {
        organization,
        transactionNames: mockTransactionNames,
        extraConditions: 'transaction.duration>:300ms',
      },
    });

    expect(result.current).toEqual({});
    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: {
          query: `transaction:["/home","/profile"] transaction.duration>:300ms`,
          data_source: 'discover',
          project: -1,
          statsPeriod: '14d',
        },
      })
    );

    await waitForNextUpdate();
  });
});
