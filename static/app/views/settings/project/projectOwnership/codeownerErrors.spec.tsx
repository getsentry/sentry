import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CodeOwnerErrors} from './codeownerErrors';

describe('CodeownerErrors', () => {
  const project = TestStubs.Project();
  const org = TestStubs.Organization();

  it('should render errors', () => {
    const codeowner = TestStubs.CodeOwner({
      errors: {
        missing_user_emails: ['santry@example.com'],
        missing_external_users: [],
        missing_external_teams: ['@getsentry/something'],
        teams_without_access: ['#snuba'],
        users_without_access: [],
      },
    });
    render(
      <CodeOwnerErrors
        codeowners={[codeowner]}
        projectSlug={project.slug}
        orgSlug={org.slug}
      />
    );

    userEvent.click(
      screen.getByText(
        'There were 3 ownership issues within Sentry on the latest sync with the CODEOWNERS file'
      )
    );
    expect(
      screen.getByText(`There’s a problem linking teams and members from an integration`)
    ).toBeInTheDocument();
    expect(screen.getByText('@getsentry/something')).toBeInTheDocument();
  });
});
