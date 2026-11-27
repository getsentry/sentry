import {InstallWizardFixture} from 'sentry-fixture/installWizard';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import InstallWizard from 'sentry/views/admin/installWizard';

const requiredField = {required: true, disabled: false, allowEmpty: false, isSet: false};

describe('InstallWizard', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      match: [MockApiClient.matchQuery({query: 'is:required'})],
      body: InstallWizardFixture(),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders every enabled option when all are set', async () => {
    render(<InstallWizard onConfigured={jest.fn()} />);

    expect(await screen.findByRole('textbox', {name: 'Admin Email'})).toHaveValue(
      ConfigStore.get('user').email
    );
    expect(screen.getByRole('textbox', {name: 'SMTP Host'})).toHaveValue('localhost');
    expect(
      screen.getByRole('checkbox', {name: 'Use STARTTLS? (exclusive with SSL)'})
    ).not.toBeChecked();
    expect(screen.queryByRole('textbox', {name: 'Root URL'})).not.toBeInTheDocument();
  });

  it('has no option selected when beacon.anonymous is unset', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      match: [MockApiClient.matchQuery({query: 'is:required'})],
      body: InstallWizardFixture({
        'beacon.anonymous': {
          field: {required: true, disabled: false, allowEmpty: true, isSet: false},
          value: false,
        },
      }),
    });
    render(<InstallWizard onConfigured={jest.fn()} />);
    expect(
      await screen.findByRole('radio', {
        name: 'Please keep my usage information anonymous',
      })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', {
        name: 'Send my contact information along with usage statistics',
      })
    ).not.toBeChecked();
  });

  it('preserves stored settings when all options are set', async () => {
    const options = InstallWizardFixture();
    const storedValues = {
      'system.admin-email': 'admin@example.com',
      'mail.from': 'root@localhost',
      'mail.host': 'smtp.example.com',
      'mail.port': 587,
      'mail.username': 'smtp-user',
      'mail.password': 'example-password',
      'mail.use-tls': true,
      'mail.use-ssl': false,
      'beacon.record_cpu_ram_usage': false,
      'auth.allow-registration': true,
    };
    for (const [key, value] of Object.entries(storedValues)) {
      options[key] = {field: {...requiredField, allowEmpty: true, isSet: true}, value};
    }
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      match: [MockApiClient.matchQuery({query: 'is:required'})],
      body: options,
    });
    const saveRequest = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
    });
    const onConfigured = jest.fn();

    render(<InstallWizard onConfigured={onConfigured} />);

    expect(await screen.findByRole('textbox', {name: 'SMTP Host'})).toHaveValue(
      'smtp.example.com'
    );
    expect(screen.getByRole('textbox', {name: 'SMTP Password'})).toHaveValue(
      'example-password'
    );
    await userEvent.click(
      screen.getByRole('radio', {name: 'Please keep my usage information anonymous'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(saveRequest).toHaveBeenCalledWith(
      '/internal/options/',
      expect.objectContaining({
        data: {
          ...storedValues,
          'mail.port': '587',
          'beacon.record_cpu_ram_usage': 'false',
          'beacon.anonymous': 'true',
        },
      })
    );
  });

  it('has no option selected even when beacon.anonymous is set', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      match: [MockApiClient.matchQuery({query: 'is:required'})],
      body: InstallWizardFixture({
        'beacon.anonymous': {
          field: {required: true, disabled: false, allowEmpty: true, isSet: true},
          value: false,
        },
      }),
    });
    render(<InstallWizard onConfigured={jest.fn()} />);
    expect(
      await screen.findByRole('radio', {
        name: 'Please keep my usage information anonymous',
      })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', {
        name: 'Send my contact information along with usage statistics',
      })
    ).not.toBeChecked();
  });

  it('saves only the missing options and calls onConfigured', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      match: [MockApiClient.matchQuery({query: 'is:required'})],
      body: InstallWizardFixture({
        'mail.host': {field: requiredField, value: 'smtp.example.com'},
        'beacon.anonymous': {
          field: {required: true, disabled: false, allowEmpty: true, isSet: false},
        },
      }),
    });
    const saveRequest = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
    });
    const onConfigured = jest.fn();

    render(<InstallWizard onConfigured={onConfigured} />);

    expect(await screen.findByRole('textbox', {name: 'SMTP Host'})).toHaveValue(
      'smtp.example.com'
    );
    expect(screen.queryByRole('textbox', {name: 'Admin Email'})).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('radio', {name: 'Please keep my usage information anonymous'})
    );
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(saveRequest).toHaveBeenCalledWith(
      '/internal/options/',
      expect.objectContaining({
        method: 'PUT',
        query: {query: 'is:required'},
        data: {'mail.host': 'smtp.example.com', 'beacon.anonymous': 'true'},
      })
    );
  });

  it.each([
    ['not-a-url', 'https://sentry.example.com'],
    ['ftp://sentry.example.com', 'http://sentry.example.com'],
  ])('rejects Root URL %s and allows correction to %s', async (invalidUrl, validUrl) => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      match: [MockApiClient.matchQuery({query: 'is:required'})],
      body: InstallWizardFixture({
        'system.url-prefix': {field: requiredField, value: invalidUrl},
      }),
    });
    const saveRequest = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
    });
    const onConfigured = jest.fn();

    render(<InstallWizard onConfigured={onConfigured} />);

    const input = await screen.findByRole('textbox', {name: 'Root URL'});
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(
      await screen.findByText('Enter a valid HTTP or HTTPS URL')
    ).toBeInTheDocument();
    expect(saveRequest).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, validUrl);
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    await waitFor(() => expect(onConfigured).toHaveBeenCalled());
    expect(saveRequest).toHaveBeenCalledWith(
      '/internal/options/',
      expect.objectContaining({data: {'system.url-prefix': validUrl}})
    );
  });

  it.each(['root@localhost', 'sentry@localhost', 'sentry@127.0.0.1'])(
    'accepts %s as the From address after correcting an invalid email',
    async fromAddress => {
      MockApiClient.addMockResponse({
        url: '/internal/options/',
        match: [MockApiClient.matchQuery({query: 'is:required'})],
        body: InstallWizardFixture({
          'mail.from': {field: requiredField, value: 'invalid-email'},
        }),
      });
      const saveRequest = MockApiClient.addMockResponse({
        url: '/internal/options/',
        method: 'PUT',
      });
      const onConfigured = jest.fn();

      render(<InstallWizard onConfigured={onConfigured} />);

      const input = await screen.findByRole('textbox', {name: 'Email From'});
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
      expect(saveRequest).not.toHaveBeenCalled();

      await userEvent.clear(input);
      await userEvent.type(input, fromAddress);
      await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

      await waitFor(() => expect(onConfigured).toHaveBeenCalled());
      expect(saveRequest).toHaveBeenCalledWith(
        '/internal/options/',
        expect.objectContaining({data: {'mail.from': fromAddress}})
      );
    }
  );

  it('does not save while a required option is empty', async () => {
    MockApiClient.addMockResponse({
      url: '/internal/options/',
      match: [MockApiClient.matchQuery({query: 'is:required'})],
      body: InstallWizardFixture({'mail.host': {field: requiredField, value: ''}}),
    });
    const saveRequest = MockApiClient.addMockResponse({
      url: '/internal/options/',
      method: 'PUT',
    });

    render(<InstallWizard onConfigured={jest.fn()} />);

    await userEvent.clear(await screen.findByRole('textbox', {name: 'SMTP Host'}));
    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(await screen.findByText('Field is required')).toBeInTheDocument();
    expect(saveRequest).not.toHaveBeenCalled();
  });
});
