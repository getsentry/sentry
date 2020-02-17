import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import TodoList from 'app/components/onboardingWizard/todoList';

jest.mock('app/actionCreators/modal', () => ({
  openInviteMembersModal: jest.fn(),
}));

describe('TodoList', function() {
  const routerContext = TestStubs.routerContext();

  it('does not render `upload source maps` task with no projects', function() {
    const organization = TestStubs.Organization();
    const wrapper = mountWithTheme(
      <TodoList organization={organization} />,
      routerContext
    );
    expect(wrapper.find('a[data-test-id=7]').exists()).toBe(false);
  });

  it('does not render `upload source maps` task with python project', function() {
    const organization = TestStubs.Organization({
      projects: [{platform: 'python'}],
    });
    const wrapper = mountWithTheme(
      <TodoList organization={organization} />,
      routerContext
    );
    expect(wrapper.find('a[data-test-id=7]').exists()).toBe(false);
  });

  it('renders `upload source maps` task with js project', function() {
    const organization = TestStubs.Organization({
      projects: [{platform: 'javascript-react'}],
    });
    const wrapper = mountWithTheme(
      <TodoList organization={organization} />,
      routerContext
    );
    expect(wrapper.find('a[data-test-id=7]').text()).toBe('Upload source maps');
  });

  it('opens invite members modal on `invite team members` task click', function() {
    const organization = TestStubs.Organization();
    const wrapper = mountWithTheme(
      <TodoList organization={organization} />,
      routerContext
    );
    wrapper.find('a[data-test-id=3]').simulate('click');
    expect(openInviteMembersModal).toHaveBeenCalled();
    expect(wrapper.find('a[href="/organizations/org-slug/members/"]').exists()).toBe(
      false
    );
  });
});
