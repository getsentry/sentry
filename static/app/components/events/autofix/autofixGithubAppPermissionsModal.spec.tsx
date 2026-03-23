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
