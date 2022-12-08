import {reactHooks} from 'sentry-test/reactTestingLibrary';

import type {Project} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';

import useReplaysCount from './useReplaysCount';

jest.mock('sentry/utils/useLocation');

function getExpectedReqestParams({
  field,
  project,
  query,
}: {
  field: string[];
  project: Project;
  query: string;
}) {
  return expect.objectContaining({
    query: {
      environment: [],
      field,
      per_page: 50,
      project: [String(project.id)],
      query,
      statsPeriod: '14d',
    },
  });
}

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

  it('should throw if neither groupIds nor transactionNames is provided', () => {
    const {result} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        project,
      },
    });
    expect(result.error).toBeTruthy();
  });

  it('should throw if both groupIds and transactionNames are provided', () => {
    const {result} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        project,
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
      body: {data: []},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        project,
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
        456: 0,
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        project,
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

  it('should query for transactionNames', async () => {
    const countRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(useReplaysCount, {
      initialProps: {
        organization,
        project,
        transactionNames: mockTransactionNames,
      },
    });

    expect(result.current).toEqual({});
    expect(countRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      getExpectedReqestParams({
        field: ['count_unique(replayId)', 'transaction'],
        project,
        query: `!replayId:"" event.type:transaction transaction:[${mockTransactionNames.join(
          ','
        )}]`,
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
        project,
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
