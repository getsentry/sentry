import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {openModal} from 'sentry/actionCreators/modal';
import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

import {OrganizationSsoModal} from './organizationSsoModal';

const authOrganization: AuthOrganization = {
  authenticated: true,
  memberAuthenticated: false,
  canRegister: false,
  joinRequestUrl: null,
  loginMethod: 'sso',
  ssoRequired: true,
  organization: {
    avatarUrl: null,
    name: 'Acme',
    slug: 'acme',
  },
  provider: {
    key: 'saml2',
    name: 'SAML',
  },
  warnings: [],
};

describe('OrganizationSsoModal', () => {
  it('loads organization authentication and submits to the SSO login URL', async () => {
    setWindowLocation('https://sentry.io/organizations/acme/issues/?project=1');
    MockApiClient.addMockResponse({
      url: '/auth/organizations/acme/config/',
      body: authOrganization,
    });
    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <OrganizationSsoModal
          {...modalProps}
          onUnmount={jest.fn()}
          organizationSlug="acme"
        />
      ))
    );

    expect(
      await screen.findByRole('heading', {name: 'Authenticate With SSO'})
    ).toBeInTheDocument();
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Members sign in with SAML')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'SSO'}).closest('form')).toHaveAttribute(
      'action',
      '/auth/login/acme/?next=%2Forganizations%2Facme%2Fissues%2F%3Fproject%3D1'
    );
  });
});
