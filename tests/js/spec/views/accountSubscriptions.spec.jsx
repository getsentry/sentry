import PropTypes from 'prop-types';
import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import AccountSubscriptions from 'app/views/settings/account/accountSubscriptions';

const ENDPOINT = '/users/me/subscriptions/';

describe('AccountSubscriptions', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: ENDPOINT,
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
      url: ENDPOINT,
      body: TestStubs.Subscriptions(),
    });
    let mock = Client.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
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

    expect(mock).not.toHaveBeenCalled();

    wrapper
      .find('Switch')
      .first()
      .simulate('click');

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'PUT',
        data: {
          listId: 2,
          subscribed: false,
        },
      })
    );
  });
});
