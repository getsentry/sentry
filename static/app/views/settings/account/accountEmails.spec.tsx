import {AccountEmailsFixture} from 'sentry-fixture/accountEmails';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import AccountEmails from 'sentry/views/settings/account/accountEmails';

jest.mock('scroll-to-element', () => {});

const ENDPOINT = '/users/me/emails/';

describe('AccountEmails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: ENDPOINT,
      body: AccountEmailsFixture(),
    });
  });

  it('renders with emails', () => {
    render(<AccountEmails />);
  });

  it('can remove an email', async () => {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
      statusCode: 200,
    });

    render(<AccountEmails />);
    renderGlobalModal();
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Remove email'}))[0]!
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

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

  it('can change a secondary email to primary an email', async () => {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Set as primary'}))[0]!
    );

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

  it('can resend verification email', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `${ENDPOINT}confirm/`,
      method: 'POST',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    await userEvent.click(
      (await screen.findAllByRole('button', {name: 'Resend verification'}))[0]!
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

  it('can add a secondary email', async () => {
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      statusCode: 200,
    });

    render(<AccountEmails />);
    expect(mock).not.toHaveBeenCalled();

    const mockGetResponseBody = [
      ...AccountEmailsFixture(),
      {
        email: 'test@example.com',
        isPrimary: false,
        isVerified: false,
      },
    ];

    const mockGet = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'GET',
      statusCode: 200,
      body: mockGetResponseBody,
    });

    const textbox = await screen.findByRole('textbox');
    expect(screen.getAllByLabelText('Remove email')).toHaveLength(
      AccountEmailsFixture().filter(email => !email.isPrimary).length
    );

    await userEvent.type(textbox, 'test@example.com');
    await userEvent.click(screen.getByRole('button', {name: 'Add email'}));

    await waitFor(() => {
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

    await waitFor(() => {
      expect(screen.getAllByLabelText('Remove email')).toHaveLength(
        mockGetResponseBody.filter(email => !email.isPrimary).length
      );
    });

    expect(mockGet).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'GET',
      })
    );
  });
});
