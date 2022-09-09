import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import InstallWizard from 'sentry/views/admin/installWizard';

describe('InstallWizard', function () {
  beforeEach(function () {
    ConfigStore.set('version', '1.33.7');
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard(),
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders', function () {
    const wrapper = render(<InstallWizard onConfigured={jest.fn()} />);
    expect(wrapper.container).toSnapshot();
  });

  it('has no option selected when beacon.anonymous is unset', function () {
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard({
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

  it('has no option selected even when beacon.anonymous is set', function () {
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard({
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
