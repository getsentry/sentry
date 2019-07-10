import React from 'react';
import {mount} from 'enzyme';

import TodoList from 'app/components/onboardingWizard/todos';

describe('TodoList', function() {
  const routerContext = TestStubs.routerContext();

  it('does not render `upload source maps` task with no projects', function() {
    const organization = TestStubs.Organization();
    const wrapper = mount(<TodoList organization={organization} />, routerContext);
    expect(wrapper.find('h4[data-test-id=7]').exists()).toBe(false);
  });

  it('does not render `upload source maps` task with python project', function() {
    const organization = TestStubs.Organization({
      projects: [{platform: 'python'}],
    });
    const wrapper = mount(<TodoList organization={organization} />, routerContext);
    expect(wrapper.find('h4[data-test-id=7]').exists()).toBe(false);
  });

  it('renders `upload source maps` task with js project', function() {
    const organization = TestStubs.Organization({
      projects: [{platform: 'javascript-react'}],
    });
    const wrapper = mount(<TodoList organization={organization} />, routerContext);
    expect(wrapper.find('h4[data-test-id=7]').text()).toBe('Upload source maps');
  });
});
