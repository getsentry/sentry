import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListHeader from 'app/views/issueList/header';

const queryCounts = {
  'is:needs_review is:unresolved': 1,
  'is:unresolved': 1,
  'is:ignored': 1,
};

describe('IssueListHeader', () => {
  it('renders active tab with count when query matches inbox', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader query="is:needs_review is:unresolved" queryCounts={queryCounts} />
    );
    expect(wrapper.find('.active').text()).toBe('Needs Review (1)');
  });

  it("renders all tabs inactive when query doesn't match", () => {
    const wrapper = mountWithTheme(
      <IssueListHeader query="" queryCounts={queryCounts} />
    );
    expect(wrapper.find('.active').exists()).toBe(false);
  });

  it('renders all tabs with counts', () => {
    const wrapper = mountWithTheme(
      <IssueListHeader query="" queryCounts={queryCounts} />
    );
    expect(wrapper.find('li').at(0).text()).toBe('Needs Review (1)');
    expect(wrapper.find('li').at(1).text()).toBe('Unresolved (1)');
    expect(wrapper.find('li').at(2).text()).toBe('Ignored (1)');
  });

  it('transitions to new query on tab click', () => {
    const handleTabChange = jest.fn();
    const wrapper = mountWithTheme(
      <IssueListHeader onTabChange={handleTabChange} queryCounts={queryCounts} />
    );
    wrapper.find('a').at(0).simulate('click');
    expect(handleTabChange).toHaveBeenCalledWith('is:needs_review is:unresolved');
  });
});
