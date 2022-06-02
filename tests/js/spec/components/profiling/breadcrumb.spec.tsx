import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';

describe('Breadcrumb', function () {
  let location, organization;

  beforeEach(function () {
    location = TestStubs.location();
    const context = initializeOrg();
    organization = context.organization;
  });

  it('renders the profiling link', function () {
    render(
      <Breadcrumb
        location={location}
        organization={organization}
        trails={[
          {type: 'landing'},
          {
            type: 'flamegraph',
            payload: {
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
      `/organizations/${organization.slug}/profiling/`
    );
    expect(screen.getByText('foo')).toBeInTheDocument();
  });
});
