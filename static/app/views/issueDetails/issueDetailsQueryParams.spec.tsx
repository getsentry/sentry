import {OrganizationFixture} from 'sentry-fixture/organization';

import {DrawerTab} from './groupDistributions/types';
import {
  IssueDetailsDrawer,
  loadIssueDetailsQueryParams,
  makeIssueDetailsLocation,
} from './issueDetailsQueryParams';
import {Tab} from './types';

describe('loadIssueDetailsQueryParams', () => {
  it('reads the old path segments as tab and drawer values', () => {
    expect(
      loadIssueDetailsQueryParams({
        tab: 'replays',
        eventId: 'abc123',
        drawer: 'distributions',
      })
    ).toEqual({
      tab: Tab.REPLAYS,
      eventId: 'abc123',
      drawer: IssueDetailsDrawer.DISTRIBUTIONS,
    });
    expect(loadIssueDetailsQueryParams({tab: 'feedback'}).tab).toBe(Tab.USER_FEEDBACK);
    expect(loadIssueDetailsQueryParams({drawer: 'similar'}).drawer).toBe(
      IssueDetailsDrawer.SIMILAR_ISSUES
    );
  });

  it('ignores unknown values and drawers used as page tabs', () => {
    expect(
      loadIssueDetailsQueryParams({tab: 'activity', drawer: 'replays', eventId: ''})
    ).toEqual({tab: Tab.DETAILS, eventId: null, drawer: null});
    expect(loadIssueDetailsQueryParams({tab: 'Replays'}).tab).toBe(Tab.DETAILS);
  });
});

describe('makeIssueDetailsLocation', () => {
  const organization = OrganizationFixture();
  const pathname = '/organizations/org-slug/issues/101/';

  it('writes the tab, event, drawer and their params', () => {
    expect(
      makeIssueDetailsLocation({
        organization,
        groupId: '101',
        tab: Tab.ATTACHMENTS,
        tabParams: {attachmentFilter: 'screenshot'},
        eventId: 'latest',
        drawer: IssueDetailsDrawer.DISTRIBUTIONS,
        drawerParams: {tagKey: 'browser'},
      })
    ).toEqual({
      pathname,
      query: {
        tab: 'attachments',
        attachmentFilter: 'screenshot',
        eventId: 'latest',
        drawer: 'distributions',
        tagKey: 'browser',
      },
    });
  });

  it('removes params set to null', () => {
    expect(
      makeIssueDetailsLocation({
        organization,
        groupId: '101',
        drawer: IssueDetailsDrawer.DISTRIBUTIONS,
        drawerParams: {tagKey: null, type: DrawerTab.FEATURE_FLAGS},
        query: {tagKey: 'browser', tagDrawerSort: 'date'},
      }).query
    ).toEqual({drawer: 'distributions', type: 'featureFlags', tagDrawerSort: 'date'});
  });

  it('never copies the issue details params from the carried query', () => {
    expect(
      makeIssueDetailsLocation({
        organization,
        groupId: '101',
        tab: Tab.EVENTS,
        query: {tab: 'replays', eventId: 'abc123', drawer: 'merged'},
      }).query
    ).toEqual({tab: 'events'});
  });

  it('carries shared params over', () => {
    const query = {
      environment: ['prod', 'staging'],
      project: '1',
      query: 'is:unresolved',
      statsPeriod: '14d',
      referrer: 'issue-stream',
    };
    expect(
      makeIssueDetailsLocation({organization, groupId: '101', tab: Tab.REPLAYS, query})
        .query
    ).toEqual({...query, tab: 'replays'});
  });

  it('drops params scoped to a page tab or drawer the destination does not have', () => {
    expect(
      makeIssueDetailsLocation({
        organization,
        groupId: '101',
        tab: Tab.REPLAYS,
        query: {
          cursor: '0:100:0',
          attachmentFilter: 'screenshot',
          filter: 'comments',
          mergedCursor: '0:50:0',
          tagDrawerSort: 'count',
          tagKey: 'browser',
          type: 'featureFlags',
          environment: 'prod',
        },
      }).query
    ).toEqual({tab: 'replays', environment: 'prod'});
  });

  it('keeps params scoped to the destination page tab and drawer', () => {
    expect(
      makeIssueDetailsLocation({
        organization,
        groupId: '101',
        tab: Tab.ATTACHMENTS,
        drawer: IssueDetailsDrawer.MERGED,
        query: {
          cursor: '0:100:0',
          attachmentFilter: 'screenshot',
          mergedCursor: '0:50:0',
          filter: 'comments',
        },
      }).query
    ).toEqual({
      tab: 'attachments',
      drawer: 'merged',
      cursor: '0:100:0',
      attachmentFilter: 'screenshot',
      mergedCursor: '0:50:0',
    });
  });
});
