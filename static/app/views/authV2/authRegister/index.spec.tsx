import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import {ConfigStore} from 'sentry/stores/configStore';
import type {AuthConfig} from 'sentry/types/auth';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import AuthRegister from './index';

jest.unmock('@tanstack/react-pacer');

function mockAuthConfig(overrides: Partial<AuthConfig> = {}) {
  MockApiClient.addMockResponse({
    url: '/auth/config/',
    body: {
      canRegister: true,
      hasNewsletter: false,
      pendingMfa: null,
      serverHostname: 'sentry.example.com',
      ...overrides,
    } satisfies AuthConfig,
  });
}

function renderRegister() {
  return render(
    <BrandPageLayout artwork={null} background={null}>
      <BrandPageLayout.Content>
        <AuthRegister />
      </BrandPageLayout.Content>
    </BrandPageLayout>
  );
}

describe('AuthRegister', () => {
  const configState = ConfigStore.getState();

  beforeEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  it('registers an account and follows the destination from the API', async () => {
    mockAuthConfig({hasNewsletter: true});
    const register = MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      body: {nextUri: '/organizations/new/'},
    });

    renderRegister();

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'Jane Doe');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'jane@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'a-secure-password');
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Send me the Sentry newsletter'})
    );
    expect(
      screen.getByText(
        'Get product updates, educational content, and event news by email.'
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Create account'}));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        '/auth/register/',
        expect.objectContaining({
          data: {
            email: 'jane@example.com',
            name: 'Jane Doe',
            password: 'a-secure-password',
            subscribe: true,
          },
        })
      )
    );
    await waitFor(() =>
      expect(testableWindowLocation.assign).toHaveBeenCalledWith('/organizations/new/')
    );
  });

  it('enables account creation only when the form is valid', async () => {
    mockAuthConfig();
    renderRegister();

    const submit = await screen.findByRole('button', {name: 'Create account'});
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'Jane Doe');
    await userEvent.type(screen.getByRole('textbox', {name: 'Email'}), 'invalid');
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    expect(submit).toBeDisabled();

    const email = screen.getByRole('textbox', {name: 'Email'});
    await userEvent.clear(email);
    await userEvent.type(email, 'jane@example.com');
    expect(submit).toBeEnabled();

    await userEvent.clear(screen.getByLabelText('Password'));
    expect(submit).toBeDisabled();
  });

  it('shows the heading and configured policies', async () => {
    ConfigStore.set('termsUrl', 'https://example.com/terms');
    ConfigStore.set('privacyUrl', 'https://example.com/privacy');
    mockAuthConfig();

    renderRegister();

    expect(
      await screen.findByRole('heading', {name: 'Create your Account'})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Terms of Service'})).toHaveAttribute(
      'href',
      'https://example.com/terms'
    );
    expect(screen.getByRole('link', {name: 'Privacy Policy'})).toHaveAttribute(
      'href',
      'https://example.com/privacy'
    );
  });

  it('hides registration when the server does not allow it', async () => {
    mockAuthConfig({canRegister: false});

    renderRegister();

    expect(await screen.findByText('Registration is unavailable.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Create account'})
    ).not.toBeInTheDocument();
  });

  it('shows a server validation error beside the email field', async () => {
    mockAuthConfig();
    MockApiClient.addMockResponse({
      url: '/auth/register/',
      method: 'POST',
      statusCode: 400,
      body: {
        email: ['An account is already registered with that email address.'],
      },
    });

    renderRegister();

    await userEvent.type(await screen.findByRole('textbox', {name: 'Name'}), 'Jane Doe');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email'}),
      'jane@example.com'
    );
    await userEvent.type(screen.getByLabelText('Password'), 'a-secure-password');
    await userEvent.click(screen.getByRole('button', {name: 'Create account'}));

    expect(
      await screen.findByText('An account is already registered with that email address.')
    ).toBeInTheDocument();
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('shows password strength as a grade in the ring', async () => {
    mockAuthConfig();
    renderRegister();

    const password = await screen.findByLabelText('Password');
    const ring = () => screen.getByRole('progressbar', {name: 'Password strength'});
    expect(ring()).toHaveValue(0);
    expect(ring()).toHaveAttribute('aria-valuetext', 'No password entered');
    expect(ring()).toHaveTextContent('');
    expect(screen.getByRole('button', {name: 'Show password'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Show password'}));
    expect(password).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', {name: 'Hide password'}));
    expect(password).toHaveAttribute('type', 'password');

    await userEvent.type(password, '!');

    expect(ring()).toHaveValue(0);
    await waitFor(() => expect(ring()).toHaveValue(1));
    expect(ring()).toHaveAttribute('aria-valuetext', 'Very Weak');
    expect(ring()).toHaveTextContent('F');

    await userEvent.type(password, '!!!!!supersecretpassword!!!!!!');
    await waitFor(() => expect(ring()).toHaveValue(5));
    expect(ring()).toHaveAttribute('aria-valuetext', 'Very Strong');
    expect(ring()).toHaveTextContent('A');
  });
});
