import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectPlugins from 'sentry/views/settings/projectPlugins/projectPlugins';

describe('ProjectPlugins', function () {
  let wrapper;
  const plugins = TestStubs.Plugins();
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const params = {
    orgId: org.slug,
    projectId: project.slug,
  };

  it('renders', function () {
    wrapper = mountWithTheme(<ProjectPlugins params={params} plugins={plugins} />);

    expect(wrapper).toSnapshot();
  });

  it('has loading state', function () {
    wrapper = mountWithTheme(<ProjectPlugins params={params} loading plugins={[]} />);

    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });

  it('has error state when plugins=null and loading is true', function () {
    wrapper = mountWithTheme(
      <ProjectPlugins
        params={params}
        plugins={null}
        loading
        error={new Error('An error')}
      />
    );

    expect(wrapper.find('RouteError')).toHaveLength(1);
  });

  it('has error state when plugins=[]', function () {
    wrapper = mountWithTheme(
      <ProjectPlugins
        params={params}
        plugins={[]}
        loading
        error={new Error('An error')}
      />
    );
    expect(wrapper.find('RouteError')).toHaveLength(1);
  });
});
