import React from 'react';
import {mount} from 'enzyme';

import ReleaseLanding from 'app/views/projectReleases/releaseLanding';

describe('ProjectReleasesLanding', function() {
  let wrapper;

  beforeEach(function() {
    wrapper = mount(<ReleaseLanding />, TestStubs.routerContext());
  });

  it('renders first step', function() {
    expect(wrapper.find('Contributors')).toHaveLength(1);
  });

  it('renders next steps', function() {
    wrapper.find('Button').simulate('click');
    expect(wrapper.find('SuggestedAssignees')).toHaveLength(1);
    wrapper.find('Button').simulate('click');
    expect(wrapper.find('Issues')).toHaveLength(1);
    wrapper.find('Button').simulate('click');
    expect(wrapper.find('BashCard')).toHaveLength(1);
    wrapper.find('Button').simulate('click');
    expect(wrapper.find('Emails')).toHaveLength(1);
  });
});
