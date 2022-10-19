import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectPlugins from 'sentry/views/settings/projectPlugins/projectPlugins';

describe('ProjectPlugins', function () {
  const plugins = TestStubs.Plugins();
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const params = {
    orgId: org.slug,
    projectId: project.slug,
  };

  it('renders', function () {
    const result = render(<ProjectPlugins params={params} plugins={plugins} />);
    expect(result.baseElement).toSnapshot();
  });

  it('has loading state', function () {
    render(<ProjectPlugins params={params} loading plugins={[]} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('has error state when plugins=null and loading is true', function () {
    render(
      <ProjectPlugins
        params={params}
        plugins={null}
        loading
        error={new Error('An error')}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Oops! Something went wrong'})
    ).toBeInTheDocument();
  });

  it('has error state when plugins=[]', function () {
    render(
      <ProjectPlugins
        params={params}
        plugins={[]}
        loading
        error={new Error('An error')}
      />
    );

    expect(
      screen.getByRole('heading', {name: 'Oops! Something went wrong'})
    ).toBeInTheDocument();
  });
});
