import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import App from 'sentry/views/app';

describe('Sudo Modal', function () {
  const setHasPasswordAuth = hasPasswordAuth =>
    ConfigStore.set('user', {...ConfigStore.get('user'), hasPasswordAuth});

  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/internal/health/',
      body: {
        problems: [],
      },
    });
    Client.addMockResponse({
      url: '/assistant/',
      body: [],
    });
    Client.addMockResponse({
      url: '/organizations/',
      body: [TestStubs.Organization()],
    });
    Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 401,
      body: {
        detail: {
          code: 'sudo-required',
          username: 'test@test.com',
        },
      },
    });
    Client.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
  });

  it('can delete an org with sudo flow', async function () {
    setHasPasswordAuth(true);

    render(<App>{<div>placeholder content</div>}</App>);

    const api = new Client();
    const successCb = jest.fn();
    const errorCb = jest.fn();

    // No Modal
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Should return w/ `sudoRequired`
    api.request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    // Should have Modal + input
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Original callbacks should not have been called
    expect(successCb).not.toHaveBeenCalled();
    expect(errorCb).not.toHaveBeenCalled();

    // Clear mocks and allow DELETE
    Client.clearMockResponses();
    const orgDeleteMock = Client.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 200,
    });
    const sudoMock = Client.addMockResponse({
      url: '/auth/',
      method: 'PUT',
      statusCode: 200,
    });

    expect(sudoMock).not.toHaveBeenCalled();

    // "Sudo" auth
    userEvent.type(screen.getByRole('textbox', {name: 'Password'}), 'password');
    userEvent.click(screen.getByRole('button', {name: 'Confirm Password'}));

    expect(sudoMock).toHaveBeenCalledWith(
      '/auth/',
      expect.objectContaining({
        method: 'PUT',
        data: {isSuperuserModal: false, password: 'password'},
      })
    );

    // Retry API request
    await waitFor(() => expect(successCb).toHaveBeenCalled());
    expect(orgDeleteMock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        method: 'DELETE',
      })
    );

    // Sudo Modal should be closed
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows button to redirect if user does not have password auth', async function () {
    setHasPasswordAuth(false);

    render(<App>{<div>placeholder content</div>}</App>);

    const api = new Client();
    const successCb = jest.fn();
    const errorCb = jest.fn();

    // No Modal
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Should return w/ `sudoRequired`
    api.request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    // Should have Modal + input
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Continue'})).toHaveAttribute(
      'href',
      '/auth/login/?next=%2F'
    );
  });
});
