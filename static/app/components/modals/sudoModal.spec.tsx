import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import App from 'sentry/views/app';

describe('Sudo Modal', () => {
  const setHasPasswordAuth = (hasPasswordAuth: boolean) =>
    ConfigStore.set('user', {...ConfigStore.get('user'), hasPasswordAuth});

  beforeEach(() => {
    window.__initialData = {
      ...window.__initialData,
      links: {
        organizationUrl: 'https://albertos-apples.sentry.io',
        regionUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    };

    const organization = OrganizationFixture();

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/',
      body: [organization],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
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
    MockApiClient.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
    OrganizationStore.reset();
  });

  it('can delete an org with sudo flow', async () => {
    const {routerProps} = initializeOrg({router: {params: {}}});
    setHasPasswordAuth(true);

    const successCb = jest.fn();
    const errorCb = jest.fn();

    // Should return w/ `sudoRequired`
    new MockApiClient().request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    // Should have Modal + input
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // Original callbacks should not have been called
    expect(successCb).not.toHaveBeenCalled();
    expect(errorCb).not.toHaveBeenCalled();

    // Clear mocks and allow DELETE
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/authenticators/',
      body: [],
    });
    const orgDeleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'DELETE',
      statusCode: 200,
    });
    const sudoMock = MockApiClient.addMockResponse({
      url: '/auth/',
      method: 'PUT',
      statusCode: 200,
    });

    expect(sudoMock).not.toHaveBeenCalled();

    // "Sudo" auth
    await userEvent.type(
      await screen.findByRole('textbox', {name: 'Password'}),
      'password'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Confirm Password'}));

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

  it('shows button to redirect if user does not have password auth', async () => {
    const {routerProps} = initializeOrg({router: {params: {}}});
    setHasPasswordAuth(false);

    // Should return w/ `sudoRequired` and trigger the modal to open
    new MockApiClient().request('/organizations/org-slug/', {method: 'DELETE'});

    render(
      <App {...routerProps}>
        <div>placeholder content</div>
      </App>
    );

    // Should have Modal + input
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Continue'})).toHaveAttribute(
      'href',
      '/auth/login/?next=http%3A%2F%2Flocalhost%2F'
    );
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
});
