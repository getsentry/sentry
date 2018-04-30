import React from 'react';
import {shallow, mount} from 'enzyme';
import ProjectPluginRow from 'app/views/projectPlugins/projectPluginRow';

describe('ProjectPluginRow', function() {
  let wrapper;
  let plugin = TestStubs.Plugin();
  let org = TestStubs.Organization();
  let project = TestStubs.Project();
  let params = {orgId: org.slug, projectId: project.slug};

  it('renders', function() {
    wrapper = shallow(<ProjectPluginRow {...params} {...plugin} />);

    expect(wrapper).toMatchSnapshot();
  });

  it('calls `onChange` when clicked', function() {
    let onChange = jest.fn();
    wrapper = mount(<ProjectPluginRow {...params} {...plugin} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
    wrapper.find('Switch').simulate('click');
    expect(onChange).toHaveBeenCalledWith('amazon-sqs', true);
  });
});
