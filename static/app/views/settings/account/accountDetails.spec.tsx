import {UserDetailsFixture} from 'sentry-fixture/userDetails';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
