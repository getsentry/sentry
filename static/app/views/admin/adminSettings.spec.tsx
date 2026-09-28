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
      await userEvent.tab();

      expect(save).not.toHaveBeenCalled();
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
