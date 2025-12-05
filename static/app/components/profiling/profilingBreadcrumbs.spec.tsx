import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('Breadcrumb', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([ProjectFixture({slug: 'bar'})]);
  });

  it('renders the profiling link', () => {
    const {organization} = initializeOrg();
    render(
      <ProfilingBreadcrumbs
        organization={organization}
        trails={[
          {type: 'landing', payload: {query: {}}},
          {
            type: 'flamechart',
            payload: {
              query: {},
              transaction: 'foo',
              profileId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              projectSlug: 'bar',
            },
          },
        ]}
      />
    );
    expect(screen.getByText('Profiling')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Profiling'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/profiling/`
    );
    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
