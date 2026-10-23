import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {OAuthAuthentication} from './oauthAuthentication';

it.each([
  {ssoRequired: false, authenticated: false, showAccountLogin: true},
  {ssoRequired: true, authenticated: false, showAccountLogin: false},
  {ssoRequired: true, authenticated: true, showAccountLogin: true},
])(
  'offers account login=$showAccountLogin when SSO required=$ssoRequired and authenticated=$authenticated',
  async ({ssoRequired, authenticated, showAccountLogin}) => {
    MockApiClient.addMockResponse({
      url: '/auth/organizations/org-slug/config/',
      body: {
        organization: {name: 'Example Org', slug: 'org-slug', avatarUrl: null},
        provider: {key: 'saml2', name: 'SAML'},
        loginMethod: 'sso',
        ssoRequired,
        authenticated,
      },
    });
    render(
      <OAuthAuthentication
        authConfig={{
          pendingMfa: null,
          serverHostname: 'sentry.example.com',
          canRegister: false,
          hasNewsletter: false,
          singleOrganizationSlug: 'org-slug',
          googleLoginLink: '/auth/google/',
        }}
        returnTo="/oauth/authorize/"
        onAuthenticated={jest.fn()}
      />
    );
    await waitFor(() => expect(screen.getByRole('button', {name: 'SSO'})).toBeVisible());
    expect(screen.queryAllByRole('button', {name: 'Google'})).toHaveLength(
      showAccountLogin ? 1 : 0
    );
    expect(screen.queryAllByRole('textbox', {name: 'Email'})).toHaveLength(
      showAccountLogin ? 1 : 0
    );
  }
);
