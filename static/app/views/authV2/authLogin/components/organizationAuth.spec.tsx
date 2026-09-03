import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {AuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';

import {OrganizationAuth} from './organizationAuth';

const authOrganization: AuthOrganization = {
  authenticated: false,
  memberAuthenticated: false,
  canRegister: false,
  joinRequestUrl: '/join-request/acme/',
  loginMethod: 'sso',
  ssoRequired: true,
  organization: {
    avatarUrl: 'https://example.com/avatar.png',
    name: 'Acme',
    slug: 'acme',
  },
  provider: {
    key: 'saml2',
    name: 'SAML',
  },
  warnings: [],
};

describe('OrganizationAuth', () => {
  it('renders organization SSO and join request actions', async () => {
    const onClear = jest.fn();
    render(<OrganizationAuth authOrganization={authOrganization} onClear={onClear} />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Requires').parentElement).toHaveTextContent(
      'Requires sign in with SAML'
    );
    const ssoButton = screen.getByRole('button', {name: 'SSO'});
    const ssoForm = ssoButton.closest('form')!;
    expect(ssoButton).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Request to join'})).toHaveAttribute(
      'href',
      '/join-request/acme/'
    );
    expect(ssoForm).toHaveAttribute('method', 'POST');
    expect(ssoForm).toHaveFormValues({init: '1'});

    ssoForm.addEventListener('submit', event => event.preventDefault());
    await userEvent.click(ssoButton);
    expect(ssoButton).toHaveAttribute('aria-busy', 'true');

    const clearButton = screen.getByRole('button', {
      name: 'Clear organization login context',
    });
    await userEvent.hover(clearButton);
    expect(
      await screen.findByText('Clear organization login context')
    ).toBeInTheDocument();

    await userEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('disables SSO and explains when it is not configured', async () => {
    render(
      <OrganizationAuth
        authOrganization={{
          ...authOrganization,
          joinRequestUrl: null,
          loginMethod: 'password',
          provider: null,
          ssoRequired: false,
        }}
        onClear={jest.fn()}
      />
    );

    const ssoButton = screen.getByRole('button', {name: 'SSO'});
    expect(ssoButton).toBeDisabled();
    expect(
      screen.getByText('Members sign in with email and password')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('This organization does not have Single Sign-On configured')
    ).not.toBeInTheDocument();
    await userEvent.hover(ssoButton.parentElement!);
    expect(
      await screen.findByText('This organization does not have Single Sign-On configured')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Request to join'})
    ).not.toBeInTheDocument();
  });

  it('describes optional SSO for members', () => {
    render(
      <OrganizationAuth
        authOrganization={{...authOrganization, ssoRequired: false}}
        onClear={jest.fn()}
      />
    );

    expect(screen.getByText('Members sign in with SAML')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'SSO'})).toBeEnabled();
  });
});
