import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixGithubAppPermissionsModal} from 'sentry/components/events/autofix/autofixGithubAppPermissionsModal';

describe('AutofixGithubAppPermissionsModal', () => {
  it('renders the modal', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => <AutofixGithubAppPermissionsModal {...deps} />);
    });

    expect(await screen.findByText('Update GitHub App Permissions')).toBeInTheDocument();
    expect(screen.getByText(/does not have sufficient permissions/)).toBeInTheDocument();
  });

  it('uses a custom first sentence and always links settings in the body', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => (
        <AutofixGithubAppPermissionsModal
          {...deps}
          description="Seer had trouble talking to GitHub while running Autofix."
        />
      ));
    });

    expect(
      await screen.findByText(/Seer had trouble talking to GitHub while running Autofix/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'GitHub App installation settings'})
    ).toHaveAttribute('href', 'https://github.com/settings/installations/');
  });

  it('uses a provided installation URL', async () => {
    const installationUrl =
      'https://github.com/organizations/example-org/settings/installations/654321/permissions/update';

    renderGlobalModal();

    act(() => {
      openModal(deps => (
        <AutofixGithubAppPermissionsModal {...deps} installationUrl={installationUrl} />
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
      openModal(deps => <AutofixGithubAppPermissionsModal {...deps} />);
    });

    const updateButton = await screen.findByRole('button', {name: 'Update Permissions'});
    expect(updateButton).toHaveAttribute(
      'href',
      'https://github.com/settings/installations/'
    );
  });
});
