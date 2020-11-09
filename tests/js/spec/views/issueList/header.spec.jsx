import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import IssueListHeader from 'app/views/issueList/header';

describe('IssueListHeader', () => {
  it('renders active tab with count when query matches inbox', () => {
    const wrapper = mountWithTheme(<IssueListHeader query="is:inbox" queryCount={1} />);
    expect(wrapper.find('.active').text()).toBe('Inbox (1)');
  });

  it("renders all tabs inactive when query doesn't match", () => {
    const wrapper = mountWithTheme(<IssueListHeader query="" queryCount={1} />);
    expect(wrapper.find('.active').exists()).toBe(false);
  });

  it('transitions to new query on tab click', () => {
    const handleTabChange = jest.fn();
    const wrapper = mountWithTheme(<IssueListHeader onTabChange={handleTabChange} />);
    wrapper.find('a').at(0).simulate('click');
    expect(handleTabChange).toHaveBeenCalledWith('is:inbox');
  });
});
