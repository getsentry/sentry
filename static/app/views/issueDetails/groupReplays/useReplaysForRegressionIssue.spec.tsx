import {Location} from 'history';
import {Event as EventFixture} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {EventOccurrence, IssueCategory} from 'sentry/types';
import {useLocation} from 'sentry/utils/useLocation';
import useReplaysForRegressionIssue from 'sentry/views/issueDetails/groupReplays/useReplaysForRegressionIssue';

jest.mock('sentry/utils/useLocation');

describe('useReplaysForRegressionIssue', () => {
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

  const mockEvent = {
    ...EventFixture(),
    occurrence: {
      evidenceDisplay: {} as EventOccurrence['evidenceDisplay'],
      detectionTime: 'mock-detection-time',
      eventId: 'eventId',
      fingerprint: ['fingerprint'],
      id: 'id',
      issueTitle: 'Transaction Duration Regression',
      subtitle: 'Increased from 20.64ms to 36.24ms (P95)',
      resourceId: '',
      type: 1017,
      evidenceData: {
        transaction: 'mock-transaction',
        aggregateRange2: 100,
        breakpoint: Date.now() / 1000, // The breakpoint is stored in seconds
      },
    },
  };

  it('should fetch a list of replay ids', async () => {
    const MOCK_GROUP = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        ['mock-transaction']: ['replay42', 'replay256'],
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      useReplaysForRegressionIssue,
      {
        initialProps: {
          group: MOCK_GROUP,
          location,
          organization,
          event: mockEvent,
        },
      }
    );

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
    const MOCK_GROUP = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {},
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      useReplaysForRegressionIssue,
      {
        initialProps: {
          group: MOCK_GROUP,
          location,
          organization,
          event: mockEvent,
        },
      }
    );

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
    const MOCK_GROUP = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        ['mock_transaction']: ['replay42', 'replay256'],
      },
    });

    const {waitForNextUpdate} = reactHooks.renderHook(useReplaysForRegressionIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
        event: mockEvent,
      },
    });

    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: expect.objectContaining({
          start: new Date(
            mockEvent.occurrence.evidenceData.breakpoint * 1000
          ).toISOString(),
          end: new Date().toISOString(),
        }),
      })
    );

    await waitForNextUpdate();
  });

  it('queries the transaction name with event type and duration filters', async () => {
    const MOCK_GROUP = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});
    const replayCountRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/replay-count/`,
      method: 'GET',
      body: {
        ['mock_transaction']: ['replay42', 'replay256'],
      },
    });

    const {waitForNextUpdate} = reactHooks.renderHook(useReplaysForRegressionIssue, {
      initialProps: {
        group: MOCK_GROUP,
        location,
        organization,
        event: mockEvent,
      },
    });

    expect(replayCountRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/replay-count/',
      expect.objectContaining({
        query: expect.objectContaining({
          query:
            'event.type:transaction transaction:["mock-transaction"] transaction.duration:>=50ms',
        }),
      })
    );

    await waitForNextUpdate();
  });
});
