import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Login from 'sentry/views/auth/login';

describe('Login', function () {
  const {routerProps} = initializeOrg();

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders a loading indicator', function () {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {},
    });

    render(<Login {...routerProps} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('renders an error if auth config cannot be loaded', async function () {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      statusCode: 500,
    });

    render(<Login {...routerProps} />);

    expect(
      await screen.findByText('Unable to load authentication configuration')
    ).toBeInTheDocument();
  });

  it('does not show register when disabled', async function () {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: false},
    });

    render(<Login {...routerProps} />);

    expect(await screen.findByText('Lost your password?')).toBeInTheDocument();
    expect(screen.queryByText('Register')).not.toBeInTheDocument();
  });

  it('shows register when canRegister is enabled', async function () {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: true},
    });

    render(<Login {...routerProps} />);

    expect(await screen.findByRole('link', {name: 'Register'})).toBeInTheDocument();
  });

  it('toggles between tabs', async function () {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: true},
    });

    render(<Login {...routerProps} />);

    // Default tab is login
    expect(await screen.findByPlaceholderText('username or email')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', {name: 'Single Sign-On'}));
    expect(screen.getByRole('textbox', {name: 'Organization ID'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', {name: 'Register'}));
    expect(screen.getByRole('textbox', {name: 'Name'})).toBeInTheDocument();
  });
});
