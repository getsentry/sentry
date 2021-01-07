import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListHeader from 'app/views/issueList/header';

const queryCounts = {
  'is:unresolved is:needs_review owner:me_or_none': {
    count: 22,
    hasMore: false,
  },
  'is:unresolved is:needs_review': {
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
  'is:unresolved is:needs_review': {
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
        query="is:unresolved is:needs_review"
        queryCounts={queryCounts}
        projectIds={[]}
      />
    );
    expect(wrapper.find('.active').text()).toBe('Needs Review 1');
  });

  it('renders active tab with count when query matches inbox with owners:me_or_none', () => {
    organization.features = ['inbox-owners-query'];
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query="is:unresolved is:needs_review owner:me_or_none"
        queryCounts={queryCounts}
        projectIds={[]}
      />
    );
    expect(wrapper.find('.active').text()).toBe('Needs Review 22');
  });

  it('renders reprocessing tab', () => {
    organization.features = ['reprocessing-v2'];
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query=""
        queryCounts={{
          ...queryCounts,
          'is:reprocessing': {
            count: 1,
            hasMore: false,
          },
        }}
        displayReprocessingTab
        projectIds={[]}
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
      />
    );
    expect(wrapper.find('.active').exists()).toBe(false);
  });

  it('renders all tabs with counts', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query=""
        queryCounts={queryCounts}
        projectIds={[]}
      />
    );
    expect(wrapper.find('li').at(0).text()).toBe('Needs Review 1');
    expect(wrapper.find('li').at(1).text()).toBe('All Unresolved 1');
    expect(wrapper.find('li').at(2).text()).toBe('Ignored ');
  });

  it('renders limited counts for tabs and exact for selected', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        query=""
        queryCounts={queryCountsMaxed}
        projectIds={[]}
      />
    );
    expect(wrapper.find('li').at(0).text()).toBe('Needs Review 321');
    expect(wrapper.find('li').at(1).text()).toBe('All Unresolved 99+');
    expect(wrapper.find('li').at(2).text()).toBe('Ignored 99+');
  });

  it('transitions to new query on tab click', () => {
    const handleTabChange = jest.fn();
    const wrapper = mountWithTheme(
      <IssueListHeader
        organization={organization}
        onTabChange={handleTabChange}
        queryCounts={queryCounts}
        projectIds={[]}
      />
    );
    wrapper.find('a').at(0).simulate('click');
    expect(handleTabChange).toHaveBeenCalledWith('is:unresolved is:needs_review');
  });
});
