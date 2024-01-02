import {Location} from 'history';
import {Group as GroupFixture} from 'sentry-fixture/group';
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
    const MOCK_GROUP = GroupFixture();

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
    const MOCK_GROUP = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

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
    const MOCK_GROUP = GroupFixture();

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
