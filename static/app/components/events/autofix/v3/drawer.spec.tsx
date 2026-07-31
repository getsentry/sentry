import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutofixWarnings} from 'sentry/components/events/autofix/v3/drawer';

describe('AutofixWarnings', () => {
  const organization = OrganizationFixture();

  it('deduplicates repo names', () => {
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
            repo_name: 'getsentry/sentry',
          },
        ]}
      />,
      {organization}
    );

    expect(screen.getAllByText('getsentry/sentry')).toHaveLength(1);
    expect(screen.getByText(/The configured GitHub App for/)).toBeInTheDocument();
  });

  it('renders fallback copy when repo names are missing', () => {
    render(
      <AutofixWarnings
        groupId="1"
        warnings={[
          {
            warning_type: 'github_app_permissions',
          },
        ]}
      />,
      {organization}
    );

    expect(
      screen.getByText(
        'The configured GitHub App is missing permissions. Update the app and ask Seer to retry.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/The configured GitHub App for/)).not.toBeInTheDocument();
  });
});
