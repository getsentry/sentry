import {AccountEmails as AccountEmailsFixture} from 'sentry-fixture/accountEmails';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AccountEmails from 'sentry/views/settings/account/accountEmails';

jest.mock('scroll-to-element', () => {});

const ENDPOINT = '/users/me/emails/';

describe('AccountEmails', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: AccountEmailsFixture(),
    });
  });

  it('renders with emails', function () {
    render(<AccountEmails />);
  });

  it('can remove an email', async function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole('button', {name: 'Remove email'})[0]);

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

  it('can change a secondary email to primary an email', async function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(screen.getAllByRole('button', {name: 'Set as primary'})[0]);

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

  it('can resend verification email', async function () {
    const mock = MockApiClient.addMockResponse({
      url: `${ENDPOINT}confirm/`,
      method: 'POST',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getAllByRole('button', {name: 'Resend verification'})[0]
    );

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

  it('can add a secondary email', async function () {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('textbox'), 'test@example.com{enter}');

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
