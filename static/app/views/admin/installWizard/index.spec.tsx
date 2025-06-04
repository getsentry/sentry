import {InstallWizardFixture} from 'sentry-fixture/installWizard';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import InstallWizard from 'sentry/views/admin/installWizard';

describe('InstallWizard', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: InstallWizardFixture(),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    render(<InstallWizard onConfigured={jest.fn()} />);
  });

  it('has no option selected when beacon.anonymous is unset', async function () {
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: InstallWizardFixture({
        'beacon.anonymous': {
          field: {
            disabledReason: null,
            default: false,
            required: true,
            disabled: false,
            allowEmpty: true,
            isSet: false,
          },
          value: false,
        },
      }),
    });
    render(<InstallWizard onConfigured={jest.fn()} />);
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      screen.getByRole('radio', {
        name: 'Please keep my usage information anonymous',
      })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', {
        name: 'Send my contact information along with usage statistics',
      })
    ).not.toBeChecked();
  });

  it('has no option selected even when beacon.anonymous is set', async function () {
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: InstallWizardFixture({
        'beacon.anonymous': {
          field: {
            disabledReason: null,
            default: false,
            required: true,
            disabled: false,
            allowEmpty: true,
            isSet: true,
          },
          value: false,
        },
      }),
    });
    render(<InstallWizard onConfigured={jest.fn()} />);
    expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      screen.getByRole('radio', {
        name: 'Please keep my usage information anonymous',
      })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', {
        name: 'Send my contact information along with usage statistics',
      })
    ).not.toBeChecked();
  });
});
