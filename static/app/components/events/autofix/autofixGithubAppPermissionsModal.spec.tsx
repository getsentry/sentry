import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';

describe('AutofixGithubAppPermissionsModal', () => {
  it('renders the coding-agent handoff variant', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => (
        <AutofixGithubAppPermissionsModal {...deps} variant="coding_agent_handoff" />
      ));
    });

    expect(await screen.findByText('Update GitHub App Permissions')).toBeInTheDocument();
    expect(screen.getByText(/does not have sufficient permissions/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'GitHub App installation settings'})
    ).toBeInTheDocument();
  });

  it('renders the pr-iteration variant', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => (
        <AutofixGithubAppPermissionsModal {...deps} variant="pr_iteration" />
      ));
    });

    expect(
      await screen.findByText(
        /Seer needs additional GitHub App permissions to keep iterating on the pull requests in this run/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Review and accept the updated permissions to let Seer continue/)
    ).toBeInTheDocument();
  });

  it('renders the integration-settings variant with its missing features', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => (
        <AutofixGithubAppPermissionsModal
          {...deps}
          variant="integration_settings"
          missingFeatures={[
            {
              key: 'code_review',
              name: 'Seer Code Review',
              description: 'Seer Code Review: Reviews your pull requests.',
            },
            {
              key: 'pr_iteration',
              name: 'Pull request iteration',
              description:
                'Seer PR Iteration: Reads GitHub Actions logs and re-runs jobs.',
            },
          ]}
        />
      ));
    });

    expect(
      await screen.findByText(
        'This installation is missing permissions for the following features:'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Seer Code Review: Reviews your pull requests.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Seer PR Iteration: Reads GitHub Actions logs and re-runs jobs.')
    ).toBeInTheDocument();
  });

  it('uses a provided installation URL', async () => {
    const installationUrl =
      'https://github.com/organizations/example-org/settings/installations/654321/permissions/update';

    renderGlobalModal();

    act(() => {
      openModal(deps => (
        <AutofixGithubAppPermissionsModal
          {...deps}
          variant="coding_agent_handoff"
          installationUrl={installationUrl}
        />
      ));
    });

    const updateButton = await screen.findByRole('button', {name: 'Update Permissions'});
    expect(updateButton).toHaveAttribute('href', installationUrl);
    expect(
      screen.getByRole('link', {name: 'GitHub App installation settings'})
    ).toHaveAttribute('href', installationUrl);
  });

  it('renders update permissions button linking to GitHub settings', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => (
        <AutofixGithubAppPermissionsModal {...deps} variant="coding_agent_handoff" />
      ));
    });

    const updateButton = await screen.findByRole('button', {name: 'Update Permissions'});
    expect(updateButton).toHaveAttribute(
      'href',
      'https://github.com/settings/installations/'
    );
  });
});
