import React from 'react';
import {shallow} from 'sentry-test/enzyme';
import {InstallPromptBanner} from 'app/views/organizationDetails/installPromptBanner';

describe('InstallPromptBanner', function() {
  it('renders', function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project({firstEvent: null});
    const organization = TestStubs.Organization({projects: [project1, project2]});
    const wrapper = shallow(
      <InstallPromptBanner config={{}} organization={organization} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert').exists()).toBe(true);
    expect(wrapper.find('a').text()).toContain('Start capturing errors');
  });

  it('does not render if first event sent', function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project({firstEvent: '2018-03-18'});
    const organization = TestStubs.Organization({projects: [project1, project2]});
    const wrapper = shallow(
      <InstallPromptBanner organization={organization} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert').exists()).toBe(false);
  });

  it('renders using projects props', function() {
    const project1 = TestStubs.Project();
    const project2 = TestStubs.Project({firstEvent: '2018-03-18'});
    const organization = TestStubs.Organization();
    const wrapper = shallow(
      <InstallPromptBanner
        config={{}}
        organization={organization}
        projects={[project1, project2]}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert').exists()).toBe(false);
  });
});
