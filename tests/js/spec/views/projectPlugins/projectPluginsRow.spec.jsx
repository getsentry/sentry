import React from 'react';
import {mount} from 'enzyme';
import ProjectPluginRow from 'app/views/projectPlugins/projectPluginRow';

describe('ProjectPluginRow', function() {
  let wrapper;
  let plugin = TestStubs.Plugin();
  let org = TestStubs.Organization({access: ['project:write']});
  let project = TestStubs.Project();
  let params = {orgId: org.slug, projectId: project.slug};
  let routerContext = TestStubs.routerContext([{organization: org, project}]);

  it('renders', function() {
    wrapper = mount(<ProjectPluginRow {...params} {...plugin} />, routerContext);

    expect(wrapper).toMatchSnapshot();
  });

  it('calls `onChange` when clicked', function() {
    let onChange = jest.fn();
    wrapper = mount(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} />,
      routerContext
    );

    expect(onChange).not.toHaveBeenCalled();
    wrapper.find('Switch').simulate('click');
    expect(onChange).toHaveBeenCalledWith('amazon-sqs', true);
  });

  it('can not enable/disable or configure plugin without `project:write`', function() {
    let onChange = jest.fn();
    wrapper = mount(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} />,
      TestStubs.routerContext([{organization: TestStubs.Organization({access: []})}])
    );

    expect(onChange).not.toHaveBeenCalled();
    wrapper.find('Switch').simulate('click');
    expect(onChange).not.toHaveBeenCalled();
  });
});
