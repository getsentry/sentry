import PropTypes from 'prop-types';
import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import ApiTokens from 'app/views/settings/account/apiTokens';

describe('ApiTokens', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty result', function() {
    Client.addMockResponse({
      url: '/api-tokens/',
    });

    let wrapper = shallow(<ApiTokens />, {
      childContextTypes: {
        router: PropTypes.object,
      },
      context: {
        router: TestStubs.router(),
      },
    });

    // Should be loading
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with result', function() {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    let wrapper = mount(<ApiTokens />, {
      childContextTypes: {
        router: PropTypes.object,
      },
      context: {
        router: TestStubs.router(),
      },
    });

    // Should be loading
    expect(wrapper).toMatchSnapshot();
  });

  it('can delete token', function() {
    Client.addMockResponse({
      url: '/api-tokens/',
      body: [TestStubs.ApiToken()],
    });

    let mock = Client.addMockResponse({
      url: '/api-tokens/',
      method: 'DELETE',
    });

    expect(mock).not.toHaveBeenCalled();

    let wrapper = mount(<ApiTokens />, {
      childContextTypes: {
        router: PropTypes.object,
      },
      context: {
        router: TestStubs.router(),
      },
    });

    wrapper.find('.icon-trash').simulate('click');

    // Should be loading
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      '/api-tokens/',
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
