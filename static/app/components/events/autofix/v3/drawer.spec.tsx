import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutofixWarnings} from 'sentry/components/events/autofix/v3/drawer';

describe('AutofixWarnings', () => {
  const organization = OrganizationFixture();

  it('renders the generic missing-permissions banner without repo names', () => {
    render(
      <AutofixWarnings
        groupId="1"
        warnings={[
          {
            warning_type: 'github_app_permissions',
            repo_name: 'getsentry/sentry',
          },
          {
            warning_type: 'github_app_permissions',
            repo_name: 'getsentry/seer',
          },
        ]}
      />,
      {organization}
    );

    expect(
      screen.getByText(
        'Seer needs more GitHub App permissions to keep fixing CI on your pull requests.'
      )
    ).toBeInTheDocument();
    // The banner no longer enumerates the affected repositories.
    expect(screen.queryByText('getsentry/sentry')).not.toBeInTheDocument();
    expect(screen.queryByText('getsentry/seer')).not.toBeInTheDocument();
  });
});
