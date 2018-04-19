import React from 'react';
import PropTypes from 'prop-types';
import {shallow} from 'enzyme';

import {GroupEvents} from 'app/views/groupEvents';

describe('groupEvents', function() {
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/issues/1/events/',
      body: TestStubs.Events(),
    });
  });

  it('renders', function() {
    const component = shallow(
      <GroupEvents
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        location={{query: {}}}
      />,
      {
        context: {...TestStubs.router(), group: TestStubs.Group()},
        childContextTypes: {
          router: PropTypes.object,
        },
      }
    );
    expect(component).toMatchSnapshot();
  });
});
