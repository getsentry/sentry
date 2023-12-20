import {CodeOwner as CodeOwnerFixture} from 'sentry-fixture/codeOwner';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CodeOwnerErrors} from './codeownerErrors';

describe('CodeownerErrors', () => {
  const project = ProjectFixture();
  const org = Organization();

  it('should render errors', async () => {
    const codeowner = CodeOwnerFixture({
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

    await userEvent.click(
      screen.getByText(
        'There were 3 ownership issues within Sentry on the latest sync with the CODEOWNERS file'
      )
    );
    expect(
      screen.getByText(`There’s a problem linking teams and members from an integration`)
    ).toBeInTheDocument();
    expect(screen.getByText('@getsentry/something')).toBeInTheDocument();
  });

  it('should deduplicate errors', () => {
    const codeowner = CodeOwnerFixture({
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
        codeowners={[codeowner, {...codeowner, id: '123'}]}
        projectSlug={project.slug}
        orgSlug={org.slug}
      />
    );

    expect(
      screen.getByText(
        'There were 3 ownership issues within Sentry on the latest sync with the CODEOWNERS file'
      )
    ).toBeInTheDocument();
  });
});
