import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListHeader from 'app/views/issueList/header';

const queryCounts = {
  'is:needs_review is:unresolved': 1,
  'is:unresolved': 1,
};

const queryCountsMaxed = {
  'is:needs_review is:unresolved': 1000,
  'is:unresolved': 1000,
};

describe('IssueListHeader', () => {
  it('renders active tab with count when query matches inbox', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader
        query="is:needs_review is:unresolved"
        queryCounts={queryCounts}
        projectIds={[]}
      />
    );
    expect(wrapper.find('.active').text()).toBe('Needs Review 1');
  });

  it("renders all tabs inactive when query doesn't match", () => {
    const wrapper = mountWithTheme(
      <IssueListHeader query="" queryCounts={queryCounts} projectIds={[]} />
    );
    expect(wrapper.find('.active').exists()).toBe(false);
  });

  it('renders all tabs with counts', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader query="" queryCounts={queryCounts} projectIds={[]} />
    );
    expect(wrapper.find('li').at(0).text()).toBe('Needs Review 1');
    expect(wrapper.find('li').at(1).text()).toBe('Unresolved 1');
    expect(wrapper.find('li').at(2).text()).toBe('Ignored ');
  });

  it('renders limited counts for tabs', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader query="" queryCounts={queryCountsMaxed} projectIds={[]} />
    );
    expect(wrapper.find('li').at(0).text()).toBe('Needs Review 99+');
    expect(wrapper.find('li').at(1).text()).toBe('Unresolved 99+');
    expect(wrapper.find('li').at(2).text()).toBe('Ignored ');
  });

  it('transitions to new query on tab click', () => {
    const handleTabChange = jest.fn();
    const wrapper = mountWithTheme(
      <IssueListHeader
        onTabChange={handleTabChange}
        queryCounts={queryCounts}
        projectIds={[]}
      />
    );
    wrapper.find('a').at(0).simulate('click');
    expect(handleTabChange).toHaveBeenCalledWith('is:needs_review is:unresolved');
  });
});
