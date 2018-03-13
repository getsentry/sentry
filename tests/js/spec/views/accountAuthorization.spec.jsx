import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {shallow} from 'enzyme';
import AccountAuthorizations from 'app/views/settings/account/accountAuthorizations';

describe('AccountAuthorizations', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  it('renders empty', function() {
    Client.addMockResponse({
      url: '/api-authorizations/',
      method: 'GET',
      body: [],
    });

    let wrapper = shallow(<AccountAuthorizations />, {
      context: {
        location: TestStubs.location(),
        router: TestStubs.router(),
      },
      childContextTypes: {
        location: PropTypes.object,
        router: PropTypes.object,
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});
