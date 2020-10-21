import {mount} from 'sentry-test/enzyme';

import ProjectPluginRow from 'app/views/settings/projectPlugins/projectPluginRow';

describe('ProjectPluginRow', function () {
  let wrapper;
  const plugin = TestStubs.Plugin();
  const org = TestStubs.Organization({access: ['project:write']});
  const project = TestStubs.Project();
  const params = {orgId: org.slug, projectId: project.slug};
  const routerContext = TestStubs.routerContext([{organization: org, project}]);

  it('renders', function () {
    wrapper = mount(<ProjectPluginRow {...params} {...plugin} />, routerContext);

    expect(wrapper).toSnapshot();
  });

  it('calls `onChange` when clicked', function () {
    const onChange = jest.fn();
    wrapper = mount(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} />,
      routerContext
    );

    expect(onChange).not.toHaveBeenCalled();
    wrapper.find('Switch').simulate('click');
    expect(onChange).toHaveBeenCalledWith('amazon-sqs', true);
  });

  it('can not enable/disable or configure plugin without `project:write`', function () {
    const onChange = jest.fn();
    wrapper = mount(
      <ProjectPluginRow {...params} {...plugin} onChange={onChange} />,
      TestStubs.routerContext([{organization: TestStubs.Organization({access: []})}])
    );

    expect(onChange).not.toHaveBeenCalled();
    wrapper.find('Switch').simulate('click');
    expect(onChange).not.toHaveBeenCalled();
  });
});
