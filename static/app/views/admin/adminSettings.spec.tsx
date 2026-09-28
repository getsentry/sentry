import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AdminSettings from 'sentry/views/admin/adminSettings';

describe('AdminSettings', () => {
  it('saves a setting with a dotted option key', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      body: {
        'system.support-email': {
          field: {disabled: false},
          value: 'original@example.com',
        },
      },
    });
    const save = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
      body: {},
    });

    render(<AdminSettings />);

    const input = await screen.findByRole('textbox', {name: 'Support Email'});
    expect(input).toHaveValue('original@example.com');
    await userEvent.clear(input);
    await userEvent.type(input, 'changed@example.com');
    await userEvent.tab();

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        '/internal/options/',
        expect.objectContaining({data: {'system.support-email': 'changed@example.com'}})
      )
    );
  });

  it.each([
    ['system.url-prefix', 'Root URL', 'not-a-url', 'Enter a valid HTTP or HTTPS URL'],
    ['system.url-prefix', 'Root URL', '   ', 'Enter a valid HTTP or HTTPS URL'],
    [
      'system.url-prefix',
      'Root URL',
      'ftp://example.com',
      'Enter a valid HTTP or HTTPS URL',
    ],
    [
      'system.support-email',
      'Support Email',
      'not-an-email',
      'Enter a valid email address',
    ],
    [
      'system.support-email',
      'Support Email',
      '     ',
      'Enter a valid email address',
      false,
    ],
    ['system.admin-email', 'Admin Email', '     ', 'Enter a valid email address'],
  ])(
    'does not save %s (%s) with %j',
    async (name, label, value, message, required = true) => {
      MockApiClient.addMockResponse({
        url: '/internal/options/',
        body: {
          [name]: {
            field: {disabled: false, required},
            value:
              name === 'system.url-prefix'
                ? 'https://sentry.example.com'
                : 'old@example.com',
          },
        },
      });
      const save = MockApiClient.addMockResponse({
        url: '/internal/options/',
        method: 'PUT',
        body: {},
      });

      render(<AdminSettings />);

      const input = await screen.findByRole('textbox', {name: label});
      await userEvent.clear(input);
      await userEvent.type(input, value);
      await userEvent.tab();

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(save).not.toHaveBeenCalled();
    }
  );

  it('clears an optional email field', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      body: {
        'system.support-email': {
          field: {disabled: false, required: false},
          value: 'old@example.com',
        },
      },
    });
    const save = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
      body: {},
    });

    render(<AdminSettings />);

    const input = await screen.findByRole('textbox', {name: 'Support Email'});
    await userEvent.clear(input);
    await userEvent.tab();

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        '/internal/options/',
        expect.objectContaining({data: {'system.support-email': ''}})
      )
    );
  });

  it('shows a saved empty optional email instead of the default email', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      body: {
        'system.support-email': {
          field: {disabled: false, required: false, allowEmpty: true},
          value: '',
        },
      },
    });

    render(<AdminSettings />);

    expect(await screen.findByRole('textbox', {name: 'Support Email'})).toHaveValue('');
  });

  it('saves a boolean setting', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      body: {
        'auth.allow-registration': {
          field: {disabled: false},
          value: false,
        },
      },
    });
    const save = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
      body: {},
    });

    render(<AdminSettings />);

    await userEvent.click(await screen.findByLabelText('Allow Registration'));
    await userEvent.tab();

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        '/internal/options/',
        expect.objectContaining({data: {'auth.allow-registration': true}})
      )
    );
  });

  it('saves a radio setting', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      body: {
        'beacon.anonymous': {
          field: {disabled: false},
          value: false,
        },
      },
    });
    const save = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
      body: {},
    });

    render(<AdminSettings />);

    await userEvent.click(
      await screen.findByRole('radio', {
        name: 'Please keep my usage information anonymous',
      })
    );
    await userEvent.tab();

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        '/internal/options/',
        expect.objectContaining({data: {'beacon.anonymous': 'true'}})
      )
    );
  });
});
