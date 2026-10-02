import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders organization SSO and join request actions', async () => {
    const onClear = jest.fn();
    render(<OrganizationAuth authOrganization={authOrganization} onClear={onClear} />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Members sign in with SAML')).toBeInTheDocument();
    const ssoButton = screen.getByRole('button', {name: 'SSO'});
    const ssoForm = ssoButton.closest('form')!;
    expect(ssoButton).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Request to join'})).toBeInTheDocument();
    expect(ssoForm).toHaveAttribute('method', 'POST');
    expect(ssoForm.querySelector('input[name="init"]')).toHaveValue('1');

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

  it('submits a join request from the organization card', async () => {
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/acme/join-request/',
      method: 'POST',
    });

    render(<OrganizationAuth authOrganization={authOrganization} />);

    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Request to join'}));

    expect(screen.getByRole('button', {name: 'Nevermind'})).toBeInTheDocument();
    expect(
      screen.getByText("Enter your email and we'll let the organization owners know.")
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'evan@example.com'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Send request'}));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({data: {email: 'evan@example.com'}})
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Sent. You'll receive an email when your request is approved."
    );
    expect(screen.getByRole('button', {name: 'Sounds good'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Nevermind'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Sounds good'}));
    await userEvent.click(screen.getByRole('button', {name: 'Request to join'}));

    expect(screen.getByRole('textbox', {name: 'Email'})).toHaveValue('');
  });

  it('closes the join request form', async () => {
    render(<OrganizationAuth authOrganization={authOrganization} />);

    await userEvent.click(screen.getByRole('button', {name: 'Request to join'}));
    expect(screen.getByRole('textbox', {name: 'Email'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Nevermind'}));
    expect(screen.queryByRole('textbox', {name: 'Email'})).not.toBeInTheDocument();
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
});
