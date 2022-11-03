import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import AccountEmails from 'sentry/views/settings/account/accountEmails';

jest.mock('scroll-to-element', () => {});

const ENDPOINT = '/users/me/emails/';

describe('AccountEmails', function () {
  beforeEach(function () {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: ENDPOINT,
      body: TestStubs.AccountEmails(),
    });
  });

  it('renders with emails', function () {
    const {container} = render(<AccountEmails />);

    expect(container).toSnapshot();
  });

  it('can remove an email', function () {
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    userEvent.click(screen.getAllByRole('button', {name: 'Remove email'})[0]);

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'DELETE',
        data: {
          email: 'secondary1@example.com',
        },
      })
    );
  });

  it('can change a secondary email to primary an email', function () {
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    userEvent.click(screen.getAllByRole('button', {name: 'Set as primary'})[0]);

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          email: 'secondary1@example.com',
        },
      })
    );
  });

  it('can resend verification email', function () {
    const mock = Client.addMockResponse({
      url: `${ENDPOINT}confirm/`,
      method: 'POST',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    userEvent.click(screen.getAllByRole('button', {name: 'Resend verification'})[0]);

    expect(mock).toHaveBeenCalledWith(
      `${ENDPOINT}confirm/`,
      expect.objectContaining({
        method: 'POST',
        data: {
          email: 'secondary2@example.com',
        },
      })
    );
  });

  it('can add a secondary email', function () {
    const mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    userEvent.type(screen.getByRole('textbox'), 'test@example.com{enter}');

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        data: {
          email: 'test@example.com',
        },
      })
    );
  });
});
