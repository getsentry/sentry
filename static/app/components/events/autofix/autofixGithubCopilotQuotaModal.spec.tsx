import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixGithubCopilotQuotaModal} from 'sentry/components/events/autofix/autofixGithubCopilotQuotaModal';

describe('AutofixGithubCopilotQuotaModal', () => {
  it('renders the modal with correct title and body', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => <AutofixGithubCopilotQuotaModal {...deps} />);
    });

    expect(
      await screen.findByText('GitHub Copilot Premium Quota Exhausted')
    ).toBeInTheDocument();
    expect(screen.getByText(/premium request quota remaining/)).toBeInTheDocument();
  });

  it('renders manage button linking to Copilot settings', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => <AutofixGithubCopilotQuotaModal {...deps} />);
    });

    const manageButton = await screen.findByRole('button', {
      name: 'Manage Copilot Plan',
    });
    expect(manageButton).toHaveAttribute('href', 'https://github.com/settings/copilot');
  });
});
