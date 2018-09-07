import React from 'react';
import {mount} from 'enzyme';

import ConfigStore from 'app/stores/configStore';
import InstallWizard from 'app/views/installWizard';

jest.mock('app/stores/configStore', () => ({
  get: jest.fn(),
}));

describe('InstallWizard', function() {
  beforeAll(function() {
    ConfigStore.get.mockImplementation(key => {
      if (key === 'version') {
        return {
          current: '1.33.7',
        };
      }
      return {};
    });
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard(),
    });
  });

  beforeEach(function() {});

  it('renders', function() {
    const wrapper = mount(<InstallWizard onConfigured={jest.fn()} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('has "Send my contact information..." when beacon.anonymous is false', function() {
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
    const wrapper = mount(<InstallWizard onConfigured={jest.fn()} />);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="false"]').prop('checked')
    ).toBe(true);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="true"]').prop('checked')
    ).toBe(false);
  });
});
