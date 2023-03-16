import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';

describe('Breadcrumb', function () {
  it('renders the profiling link', function () {
    const {organization, routerContext} = initializeOrg();
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
      />,
      {context: routerContext}
    );
    expect(screen.getByText('Profiling')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Profiling'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/profiling/?`
    );
    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
