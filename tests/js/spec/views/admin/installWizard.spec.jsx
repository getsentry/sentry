import {enzymeRender} from 'sentry-test/enzyme';

import ConfigStore from 'sentry/stores/configStore';
import InstallWizard from 'sentry/views/admin/installWizard';

describe('InstallWizard', function () {
  beforeAll(function () {
    ConfigStore.set('version', '1.33.7');
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard(),
    });
  });

  beforeEach(function () {});

  it('renders', function () {
    const wrapper = enzymeRender(<InstallWizard onConfigured={jest.fn()} />);
    expect(wrapper).toSnapshot();
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
    const wrapper = enzymeRender(<InstallWizard onConfigured={jest.fn()} />);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="false"]').prop('checked')
    ).toBe(false);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="true"]').prop('checked')
    ).toBe(false);
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
    const wrapper = enzymeRender(<InstallWizard onConfigured={jest.fn()} />);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="false"]').prop('checked')
    ).toBe(false);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="true"]').prop('checked')
    ).toBe(false);
  });
});
