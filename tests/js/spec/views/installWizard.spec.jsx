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

  it('should have beacon.anonymous off by default', function() {
    MockApiClient.addMockResponse({
      url: '/internal/options/?query=is:required',
      body: TestStubs.InstallWizard({}),
    });
    const wrapper = mount(<InstallWizard onConfigured={jest.fn()} />);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="false"]').prop('checked')
    ).toBe(false);

    expect(
      wrapper.find('input[name="beacon.anonymous"][value="true"]').prop('checked')
    ).toBe(false);
  });
});
