import React from 'react';
import {shallow} from 'enzyme';
import ProjectPlugins from 'app/views/settings/projectPlugins/projectPlugins';

describe('ProjectPlugins', function() {
  let wrapper;
  const routerContext = TestStubs.routerContext();
  const plugins = TestStubs.Plugins();
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const params = {
    orgId: org.slug,
    projectId: project.slug,
  };

  it('renders', function() {
    wrapper = shallow(
      <ProjectPlugins params={params} plugins={plugins} />,
      routerContext
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('has loading state', function() {
    wrapper = shallow(
      <ProjectPlugins params={params} loading plugins={[]} />,
      routerContext
    );

    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });

  it('has error state when plugins=null and loading is true', function() {
    wrapper = shallow(
      <ProjectPlugins
        params={params}
        plugins={null}
        loading
        error={new Error('An error')}
      />,
      routerContext
    );

    expect(wrapper.dive().find('RouteError')).toHaveLength(1);
  });

  it('has error state when plugins=[]', function() {
    wrapper = shallow(
      <ProjectPlugins
        params={params}
        plugins={[]}
        loading
        error={new Error('An error')}
      />,
      routerContext
    );
    expect(wrapper.dive().find('RouteError')).toHaveLength(1);
  });
});
