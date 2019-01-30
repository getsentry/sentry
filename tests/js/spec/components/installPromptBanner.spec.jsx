import React from 'react';
import {shallow} from 'enzyme';
import InstallPromptBanner from 'app/components/installPromptBanner';

describe('InstallPromptBanner', function() {
  it('renders', function() {
    let project1 = TestStubs.Project();
    let project2 = TestStubs.Project({firstEvent: null});
    let organization = TestStubs.Organization({projects: [project1, project2]});
    let wrapper = shallow(
      <InstallPromptBanner organization={organization} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert').exists()).toBe(true);
    expect(wrapper.find('a').text()).toContain('Start capturing errors');
  });

  it('does not render if first event sent', function() {
    let project1 = TestStubs.Project();
    let project2 = TestStubs.Project({firstEvent: '2018-03-18'});
    let organization = TestStubs.Organization({projects: [project1, project2]});
    let wrapper = shallow(
      <InstallPromptBanner organization={organization} />,
      TestStubs.routerContext()
    );
    expect(wrapper.find('StyledAlert').exists()).toBe(false);
  });
});
