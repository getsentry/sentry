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
