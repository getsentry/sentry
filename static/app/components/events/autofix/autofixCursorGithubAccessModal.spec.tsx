import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixCursorGithubAccessModal} from 'sentry/components/events/autofix/autofixCursorGithubAccessModal';

describe('AutofixCursorGithubAccessModal', () => {
  it('renders the modal with correct title and body', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => <AutofixCursorGithubAccessModal {...deps} />);
    });

    expect(await screen.findByText('Grant Cursor GitHub Access')).toBeInTheDocument();
    expect(
      screen.getByText(/does not have access to this repository/)
    ).toBeInTheDocument();
  });

  it('renders install button linking to Cursor GitHub App', async () => {
    renderGlobalModal();

    act(() => {
      openModal(deps => <AutofixCursorGithubAccessModal {...deps} />);
    });

    const installButton = await screen.findByRole('button', {
      name: 'Install Cursor GitHub App',
    });
    expect(installButton).toHaveAttribute('href', 'https://github.com/apps/cursor');
  });
});
