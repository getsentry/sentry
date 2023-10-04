import {UserDetails} from 'sentry-fixture/userDetails';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import AccountDetails from 'sentry/views/settings/account/accountDetails';

jest.mock('scroll-to-element', () => 'scroll-to-element');

function mockUserDetails(params?: any) {
  MockApiClient.clearMockResponses();

  MockApiClient.addMockResponse({
    url: '/users/me/',
    method: 'GET',
    body: UserDetails(params),
  });
}

describe('AccountDetails', function () {
  const {routerProps} = initializeOrg();

  beforeEach(function () {
    mockUserDetails();
  });

  it('renders', function () {
    render(<AccountDetails {...routerProps} />);

    expect(screen.getByRole('textbox', {name: 'Name'})).toBeEnabled();

    expect(screen.getByRole('checkbox', {name: 'Use a 24-hour clock'})).toBeEnabled();
    expect(screen.getByRole('radiogroup', {name: 'Avatar Type'})).toBeEnabled();
  });

  it('has username field if it is different than email', function () {
    mockUserDetails({username: 'different@example.com'});
    render(<AccountDetails {...routerProps} />);

    expect(screen.getByRole('textbox', {name: 'Username'})).toBeEnabled();
  });

  describe('Managed User', function () {
    it('does not have password fields', function () {
      mockUserDetails({isManaged: true});
      render(<AccountDetails {...routerProps} />);

      expect(screen.getByRole('textbox', {name: 'Name'})).toBeEnabled();
      expect(screen.queryByRole('textbox', {name: 'Password'})).not.toBeInTheDocument();
    });

    it('has disabled username field if it is different than email', function () {
      mockUserDetails({isManaged: true, username: 'different@example.com'});
      render(<AccountDetails {...routerProps} />);

      expect(screen.getByRole('textbox', {name: 'Username'})).toBeDisabled();
    });
  });
});
