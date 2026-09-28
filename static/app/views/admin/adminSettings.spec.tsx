import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import AdminSettings from 'sentry/views/admin/adminSettings';

// TODO(dcramer): this doesnt really test anything as we need to
// mock the API Response/wait on it
describe('AdminSettings', () => {
  describe('render()', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/internal/options/',
        body: {
          'system.url-prefix': {
            field: {
              disabledReason: 'diskPriority',
              default: '',
              required: true,
              disabled: true,
              allowEmpty: true,
              isSet: true,
            },
            value: 'https://sentry.example.com',
          },
          'system.admin-email': {
            field: {
              disabledReason: 'diskPriority',
              default: null,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 'foo@example.com',
          },
          'system.support-email': {
            field: {
              disabledReason: 'diskPriority',
              default: null,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 'foo@example.com',
          },
          'system.security-email': {
            field: {
              disabledReason: 'diskPriority',
              default: null,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 'foo@example.com',
          },
          'auth.allow-registration': {
            field: {
              disabledReason: 'diskPriority',
              default: false,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: true,
          },
          'auth.ip-rate-limit': {
            field: {
              disabledReason: 'diskPriority',
              default: 0,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 25,
          },
          'auth.user-rate-limit': {
            field: {
              disabledReason: 'diskPriority',
              default: 0,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 25,
          },
          'api.rate-limit.org-create': {
            field: {
              disabledReason: 'diskPriority',
              default: 0,
              required: true,
              disabled: true,
              allowEmpty: false,
              isSet: true,
            },
            value: 25,
          },
        },
      });
    });

    it('renders', () => {
      render(<AdminSettings />);
    });

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

    it('explains when a setting is managed by configuration', async () => {
      MockApiClient.addMockResponse({
        url: '/internal/options/',
        body: {
          'system.support-email': {
            field: {disabled: false},
            value: 'original@example.com',
          },
        },
      });
      MockApiClient.addMockResponse({
        url: '/internal/options/',
        method: 'PUT',
        statusCode: 400,
        body: {error: 'immutable_option'},
      });

      render(<AdminSettings />);

      const input = await screen.findByRole('textbox', {name: 'Support Email'});
      await userEvent.clear(input);
      await userEvent.type(input, 'changed@example.com');
      await userEvent.tab();

      expect(
        await screen.findByText('This setting is managed by your Sentry configuration.')
      ).toBeInTheDocument();
    });

    it('does not clear a required setting', async () => {
      MockApiClient.addMockResponse({
        url: '/internal/options/',
        body: {
          'system.url-prefix': {
            field: {disabled: false, required: true, allowEmpty: false},
            value: 'https://sentry.example.com',
          },
        },
      });
      const save = MockApiClient.addMockResponse({
        url: '/internal/options/',
        method: 'PUT',
        body: {},
      });

      render(<AdminSettings />);

      const input = await screen.findByRole('textbox', {name: 'Root URL'});
      await userEvent.clear(input);
      await userEvent.type(input, '   ');
      await userEvent.tab();

      expect(save).not.toHaveBeenCalled();
    });

    it.each([
      ['system.url-prefix', 'Root URL', 'not-a-url', 'Enter a valid HTTP or HTTPS URL'],
      [
        'system.support-email',
        'Support Email',
        'not-an-email',
        'Enter a valid email address',
      ],
      ['system.admin-email', 'Admin Email', '     ', 'Enter a valid email address'],
    ])('does not save an invalid %s', async (name, label, value, message) => {
      MockApiClient.addMockResponse({
        url: '/internal/options/',
        body: {
          [name]: {
            field: {disabled: false, required: true},
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
    });

    it.each([
      ['', true],
      ['     ', false],
    ])('handles an optional email field cleared with %j', async (value, shouldSave) => {
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
      if (value) {
        await userEvent.type(input, value);
      }
      await userEvent.tab();

      if (shouldSave) {
        await waitFor(() =>
          expect(save).toHaveBeenCalledWith(
            '/internal/options/',
            expect.objectContaining({data: {'system.support-email': ''}})
          )
        );
      } else {
        expect(
          await screen.findByText('Enter a valid email address')
        ).toBeInTheDocument();
        expect(save).not.toHaveBeenCalled();
      }
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
});
