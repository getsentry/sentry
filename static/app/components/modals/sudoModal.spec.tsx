import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeClosableHeader, ModalBody, ModalFooter} from '@sentry/scraps/modal';

import SudoModal from 'sentry/components/modals/sudoModal';
import {registerOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import type {SuperuserAccessCategoryProps} from 'sentry/types/overrides';
import {App} from 'sentry/views/app';

function TestAccessCategory({RadioItem}: SuperuserAccessCategoryProps) {
  return <RadioItem value="development">Development</RadioItem>;
}

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
    setHasPasswordAuth(true);

    const successCb = jest.fn();
    const errorCb = jest.fn();

    // Should return w/ `sudoRequired`
    new MockApiClient().request('/organizations/org-slug/', {
      method: 'DELETE',
      success: successCb,
      error: errorCb,
    });

    render(<App />);

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
    await userEvent.type(await screen.findByLabelText('Password'), 'password');
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
    setHasPasswordAuth(false);

    // Should return w/ `sudoRequired` and trigger the modal to open
    new MockApiClient().request('/organizations/org-slug/', {
      method: 'DELETE',
    });

    render(<App />);

    // Should have Modal + input
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Continue'})).toHaveAttribute(
      'href',
      '/auth/login/?next=http%3A%2F%2Flocalhost%2F'
    );
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  describe('superuser', () => {
    beforeEach(() => {
      registerOverride('component:superuser-access-category', TestAccessCategory);
      ConfigStore.set('isSelfHosted', false);
      ConfigStore.set('validateSUForm', true);
      ConfigStore.set('disableU2FForSUForm', false);
      setHasPasswordAuth(true);
    });

    function renderSuperuserModal() {
      return render(
        <SudoModal
          Header={makeClosableHeader(jest.fn())}
          Body={ModalBody}
          Footer={ModalFooter}
          closeModal={jest.fn()}
          isSuperuser
        />
      );
    }

    it('captures access details before starting WebAuthn', async () => {
      MockApiClient.addMockResponse({
        url: '/authenticators/',
        body: [{id: 'u2f', challenge: {}}],
      });
      const authRequest = MockApiClient.addMockResponse({
        url: '/auth/',
        method: 'PUT',
      });

      renderSuperuserModal();

      await userEvent.click(await screen.findByRole('radio', {name: 'Development'}));
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Reason for Access'}),
        'Investigating an issue'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      // Access form is replaced by the "Change reason" step; no auth call yet.
      expect(
        await screen.findByRole('button', {name: 'Change reason'})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Re-authenticate'})).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', {name: 'Reason for Access'})
      ).not.toBeInTheDocument();
      expect(authRequest).not.toHaveBeenCalled();
    });

    it('validates the access category and reason before continuing', async () => {
      MockApiClient.addMockResponse({
        url: '/authenticators/',
        body: [{id: 'u2f', challenge: {}}],
      });

      renderSuperuserModal();

      await userEvent.click(await screen.findByRole('button', {name: 'Continue'}));

      expect(await screen.findByText('Select an access category')).toBeInTheDocument();
      expect(
        screen.getByText('Enter a reason of at least 4 characters')
      ).toBeInTheDocument();
    });

    it('submits COPS/CSM access details when U2F is disabled', async () => {
      ConfigStore.set('disableU2FForSUForm', true);
      const authRequest = MockApiClient.addMockResponse({
        url: '/auth/',
        method: 'PUT',
      });

      renderSuperuserModal();

      await userEvent.click(await screen.findByRole('button', {name: 'COPS/CSM'}));

      await waitFor(() => {
        expect(authRequest).toHaveBeenCalledWith(
          '/auth/',
          expect.objectContaining({
            method: 'PUT',
            data: {
              isSuperuserModal: true,
              superuserAccessCategory: 'cops_csm',
              superuserReason: 'COPS and CSM use',
            },
          })
        );
      });
    });

    it('reports a missing authenticator instead of a silently inert submit', async () => {
      ConfigStore.set('isSelfHosted', true);
      MockApiClient.addMockResponse({url: '/authenticators/', body: []});
      setHasPasswordAuth(false);

      renderSuperuserModal();

      expect(
        await screen.findByText('Please add a U2F authenticator to your Sentry account')
      ).toBeInTheDocument();
    });

    it('stays on the access step when there is no authenticator', async () => {
      MockApiClient.addMockResponse({url: '/authenticators/', body: []});

      renderSuperuserModal();

      await userEvent.click(await screen.findByRole('radio', {name: 'Development'}));
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Reason for Access'}),
        'Investigating an issue'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      expect(
        await screen.findByText('Please add a U2F authenticator to your Sentry account')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', {name: 'Reason for Access'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Re-authenticate'})
      ).not.toBeInTheDocument();
    });

    it('shows an error when authentication fails', async () => {
      ConfigStore.set('disableU2FForSUForm', true);
      MockApiClient.addMockResponse({
        url: '/auth/',
        method: 'PUT',
        statusCode: 403,
        body: {detail: {code: 'invalid_password'}},
      });

      renderSuperuserModal();

      await userEvent.click(await screen.findByRole('radio', {name: 'Development'}));
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Reason for Access'}),
        'Investigating an issue'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      expect(await screen.findByText('Incorrect password')).toBeInTheDocument();
    });
  });
});
