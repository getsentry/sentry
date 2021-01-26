import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListHeader from 'app/views/issueList/header';

const queryCounts = {
  'is:unresolved is:for_review owner:me_or_none': {
    count: 22,
    hasMore: false,
  },
  'is:unresolved is:for_review': {
    count: 1,
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
  'is:unresolved is:for_review': {
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

  it('renders active tab with count when query matches inbox', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query="is:unresolved is:for_review"
        queryCount={0}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    expect(wrapper.find('.active').text()).toBe('For Review 1');
  });

  it('renders active tab with count when query matches inbox with owners:me_or_none', () => {
    organization.features = ['inbox-owners-query'];
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query="is:unresolved is:for_review owner:me_or_none"
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
    expect(tabs.at(1).text()).toBe('For Review 1');
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
      query: {query: 'is:unresolved is:for_review'},
    });
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
            query: 'is:unresolved',
            name: 'Unresolved Search',
            isPinned: false,
            isGlobal: true,
          },
        ]}
      />
    );
    wrapper.find('StyledDropdownLink').find('a').simulate('click');
    await tick();

    const item = wrapper.find('MenuItem a').first();
    expect(item.text()).toContain('Unresolved Search');
  });
});
