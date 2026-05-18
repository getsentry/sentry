import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';

describe('Breadcrumb', () => {
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
    expect(screen.getByText('Profiles')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Profiles'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/profiles/`
    );
    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
