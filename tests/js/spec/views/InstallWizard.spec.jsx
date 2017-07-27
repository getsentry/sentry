import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import ConfigStore from 'app/stores/configStore';
import InstallWizard from 'app/views/installWizard';

describe('InstallWizard', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(ConfigStore, 'get').withArgs('version').returns('1.0');
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('render()', function() {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/internal/options/?query=is:required',
        body: {
          'system.url-prefix': {
            field: {
              default: '',
              required: true,
              disabled: false,
              allowEmpty: true,
              isSet: true
            },
            value: 'https://sentry.example.com'
          },
          'system.admin-email': {
            field: {
              default: null,
              required: true,
              disabled: false,
              allowEmpty: false,
              isSet: true
            },
            value: ''
          },
          'auth.allow-registration': {
            field: {
              default: false,
              required: true,
              disabled: false,
              allowEmpty: false,
              isSet: true
            },
            value: false
          }
        }
      });
    });

    it('renders correctly', function() {
      let wrapper = shallow(<InstallWizard onConfigured={() => {}} />, {
        context: {router: TestStubs.router()}
      });
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
