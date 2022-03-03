import {mountWithTheme} from 'sentry-test/enzyme';

import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import IssueListHeader from 'sentry/views/issueList/header';
import {Query} from 'sentry/views/issueList/utils';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

const queryCounts = {
  'is:unresolved is:for_review assigned_or_suggested:[me, none]': {
    count: 22,
    hasMore: false,
  },
  'is:unresolved': {
    count: 1,
    hasMore: false,
  },
  'is:ignored': {
    count: 0,
    hasMore: false,
  },
  'is:reprocessing': {
    count: 0,
    hasMore: false,
  },
};

const queryCountsMaxed = {
  'is:unresolved is:for_review assigned_or_suggested:[me, none]': {
    count: 321,
    hasMore: false,
  },
  'is:unresolved': {
    count: 100,
    hasMore: true,
  },
  'is:ignored': {
    count: 100,
    hasMore: true,
  },
};

describe('IssueListHeader', () => {
  let organization;
  beforeEach(() => {
    organization = TestStubs.Organization();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders active tab with count when query matches inbox', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
        queryCount={0}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    expect(wrapper.find('.active').text()).toBe('For Review 22');
  });

  it('renders reprocessing tab', () => {
    organization.features = ['reprocessing-v2'];
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query=""
        queryCount={0}
        queryCounts={{
          ...queryCounts,
          'is:reprocessing': {
            count: 1,
            hasMore: false,
          },
        }}
        displayReprocessingTab
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    expect(wrapper.find('li').at(3).text()).toBe('Reprocessing 1');
  });

  it("renders all tabs inactive when query doesn't match", () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query=""
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    expect(wrapper.find('.active').exists()).toBe(false);
  });

  it('renders all tabs with counts', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query=""
        queryCount={0}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    const tabs = wrapper.find('li');
    expect(tabs.at(0).text()).toBe('All Unresolved 1');
    expect(tabs.at(1).text()).toBe('For Review 22');
    expect(tabs.at(2).text()).toBe('Ignored ');
  });

  it('renders limited counts for tabs and exact for selected', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query=""
        queryCount={0}
        queryCounts={queryCountsMaxed}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    const tabs = wrapper.find('li');
    expect(tabs.at(0).text()).toBe('All Unresolved 99+');
    expect(tabs.at(1).text()).toBe('For Review 321');
    expect(tabs.at(2).text()).toBe('Ignored 99+');
  });

  it('transitions to new query on tab click', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    const pathname = '/organizations/org-slug/issues/';
    expect(wrapper.find('Link').at(0).prop('to')).toEqual({
      pathname,
      query: {query: 'is:unresolved'},
    });
    expect(wrapper.find('Link').at(1).prop('to')).toEqual({
      pathname,
      query: {
        query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
        sort: 'inbox',
      },
    });
  });

  it('removes inbox sort for non-inbox tabs', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
        router={TestStubs.router({
          location: {
            pathname: '/test/',
            query: {sort: 'inbox'},
          },
        })}
      />,
      TestStubs.routerContext()
    );
    const pathname = '/organizations/org-slug/issues/';
    expect(wrapper.find('Link').at(0).prop('to')).toEqual({
      pathname,
      query: {query: 'is:unresolved'},
    });
    expect(wrapper.find('Link').at(2).prop('to')).toEqual({
      pathname,
      query: {
        query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
        sort: 'inbox',
      },
    });
  });

  it('changes sort for inbox tab', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
        router={TestStubs.router({
          location: {
            pathname: '/test/',
            query: {sort: 'date'},
          },
        })}
      />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('Link').at(2).prop('to')).toEqual({
      pathname: '/organizations/org-slug/issues/',
      query: {
        query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
        sort: 'inbox',
      },
    });
  });

  it('tracks clicks on inbox tab', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query={Query.UNRESOLVED}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />,
      TestStubs.routerContext()
    );
    const inboxTab = wrapper.find('Link').at(2);
    expect(inboxTab.text()).toContain('For Review');
    inboxTab.simulate('click');
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks on inbox tab when already on inbox tab', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query={Query.FOR_REVIEW}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    const inboxTab = wrapper.find('Link').at(2);
    inboxTab.simulate('click');
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(0);
  });

  it('should indicate when query is a custom search and display count', async () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
        query="not a saved search"
        queryCount={13}
      />
    );
    expect(wrapper.find('SavedSearchTab a').text()).toBe('Custom Search 13');
    expect(wrapper.find('SavedSearchTab').prop('isActive')).toBeTruthy();
  });

  it('should display saved search name and count', async () => {
    const query = 'saved search query';
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[
          {
            id: '789',
            query,
            name: 'Saved Search',
            isPinned: false,
            isGlobal: true,
          },
        ]}
        query={query}
        queryCount={13}
      />
    );
    expect(wrapper.find('SavedSearchTab a').text()).toBe('Saved Search 13');
    expect(wrapper.find('SavedSearchTab').prop('isActive')).toBeTruthy();
  });

  it('lists saved searches in dropdown', async () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[
          {
            id: '789',
            query: 'is:unresolved TypeError',
            name: 'Unresolved TypeError',
            isPinned: false,
            isGlobal: true,
          },
        ]}
      />
    );
    wrapper.find('StyledDropdownLink').find('a').simulate('click');
    await tick();

    const item = wrapper.find('MenuItem a').first();
    expect(item.text()).toContain('Unresolved TypeError');
  });
});
