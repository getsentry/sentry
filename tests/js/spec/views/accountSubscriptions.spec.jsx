import PropTypes from 'prop-types';
import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import AccountSubscriptions from 'app/views/settings/account/accountSubscriptions';

describe('AccountSubscriptions', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: '/account/subscriptions/',
      body: [],
    });
    let wrapper = shallow(<AccountSubscriptions />, {
      context: {
        router: TestStubs.router(),
      },
      childContextTypes: {
        router: PropTypes.object,
      },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('renders list and can toggle', function() {
    Client.addMockResponse({
      url: '/account/subscriptions/',
      body: TestStubs.Subscriptions(),
    });

    let wrapper = mount(<AccountSubscriptions />, {
      context: {
        router: TestStubs.router(),
      },
      childContextTypes: {
        router: PropTypes.object,
      },
    });

    expect(wrapper).toMatchSnapshot();

    let subscribeResp = {
      url: '/account/subscriptions/',
      method: 'PUT',
      data: {
        list_id: 'test list id',
        subscribed: true,
      },
    };

    Client.addMockResponse(subscribeResp);

    expect(Client.getCallCount(subscribeResp)).toBe(0);

    wrapper
      .find('Switch')
      .first()
      .simulate('click');

    expect(Client.getCallCount(subscribeResp)).toBe(1);
  });
});
