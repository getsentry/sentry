import {UserDetailsFixture} from 'sentry-fixture/userDetails';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AccountDetails from 'sentry/views/settings/account/accountDetails';

jest.mock('scroll-to-element', () => 'scroll-to-element');

function mockUserDetails(params?: any) {
  MockApiClient.clearMockResponses();

  MockApiClient.addMockResponse({
    url: '/users/me/',
    method: 'GET',
    body: UserDetailsFixture(params),
  });
}

describe('AccountDetails', () => {
  beforeEach(() => {
    mockUserDetails();
  });

  it('renders', async () => {
    render(<AccountDetails />);

    expect(await screen.findByRole('textbox', {name: 'Name'})).toBeEnabled();

    expect(screen.getByRole('checkbox', {name: 'Use a 24-hour clock'})).toBeEnabled();
    expect(screen.getByRole('radiogroup', {name: 'Avatar Type'})).toBeEnabled();
  });

  it('has username field if it is different than email', async () => {
    mockUserDetails({username: 'different@example.com'});
    render(<AccountDetails />);

    expect(await screen.findByRole('textbox', {name: 'Username'})).toBeEnabled();
  });

  describe('Managed User', () => {
    it('does not have password fields', async () => {
      mockUserDetails({isManaged: true});
      render(<AccountDetails />);

      expect(await screen.findByRole('textbox', {name: 'Name'})).toBeEnabled();
      expect(screen.queryByRole('textbox', {name: 'Password'})).not.toBeInTheDocument();
    });

    it('has disabled username field if it is different than email', async () => {
      mockUserDetails({isManaged: true, username: 'different@example.com'});
      render(<AccountDetails />);

      expect(await screen.findByRole('textbox', {name: 'Username'})).toBeDisabled();
    });
  });

  describe('Theme', () => {
    it('toggles between light and dark and removes the theme class from body', async () => {
      const mockUserUpdate = MockApiClient.addMockResponse({
        url: '/users/me/',
        method: 'PUT',
        body: UserDetailsFixture(),
      });
      render(<AccountDetails />);

      expect(await screen.findByLabelText('Theme')).toBeInTheDocument();
      // Emulate the page being loaded with a light theme
      document.body.classList.add('theme-light');

      await userEvent.click(screen.getByText('Light'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Dark'}));

      await waitFor(() => {
        expect(mockUserUpdate).toHaveBeenCalledWith(
          '/users/me/',
          expect.objectContaining({data: {options: {theme: 'dark'}}})
        );
      });
      expect(document.body).not.toHaveClass('theme-light');
    });
  });
});
