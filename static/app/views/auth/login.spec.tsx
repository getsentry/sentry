import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Login from 'sentry/views/auth/login';

describe('Login', () => {
  const {routerProps} = initializeOrg();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a loading indicator', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {},
    });

    render(<Login {...routerProps} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText('Lost your password?')).toBeInTheDocument();
  });

  it('renders an error if auth config cannot be loaded', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      statusCode: 500,
    });

    render(<Login {...routerProps} />);

    expect(
      await screen.findByText('Unable to load authentication configuration')
    ).toBeInTheDocument();
  });

  it('does not show register when disabled', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: false},
    });

    render(<Login {...routerProps} />);

    expect(await screen.findByText('Lost your password?')).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Register'})).not.toBeInTheDocument();
  });

  it('shows register when canRegister is enabled', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: true},
    });

    render(<Login {...routerProps} />);

    expect(await screen.findByRole('tab', {name: 'Register'})).toBeInTheDocument();
  });

  it('toggles between tabs', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {canRegister: true},
    });

    render(<Login {...routerProps} />);

    // Default tab is login
    expect(await screen.findByPlaceholderText('username or email')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Single Sign-On'));
    expect(screen.getByRole('textbox', {name: 'Organization ID'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Register'}));
    expect(screen.getByRole('textbox', {name: 'Name'})).toBeInTheDocument();
  });
});
