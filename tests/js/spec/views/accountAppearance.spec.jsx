import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {shallow} from 'enzyme';
import AccountAppearance from 'app/views/settings/account/accountAppearance';

jest.mock('app/api');
jest.mock('jquery');
jest.mock('scroll-to-element', () => 'scroll-to-element');

describe('AccountAppearance', function() {
  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/account/appearance/',
      method: 'GET',
      body: TestStubs.AccountAppearance(),
    });
  });

  it('renders', function() {
    let wrapper = shallow(<AccountAppearance location={{}} />, {
      context: {
        router: TestStubs.router(),
      },
      childContextTypes: {
        router: PropTypes.object,
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});
