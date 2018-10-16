import React from 'react';
import PropTypes from 'prop-types';
import {shallow} from 'enzyme';
import {browserHistory} from 'react-router';

import {GroupEvents} from 'app/views/groupEvents';

describe('groupEvents', function() {
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/issues/1/events/',
      body: TestStubs.Events(),
    });

    browserHistory.push = jest.fn();
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

  it('handles search', function() {
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

    const list = [
      {searchTerm: '', expectedQuery: {}},
      {searchTerm: 'test', expectedQuery: {query: 'test'}},
      {searchTerm: 'environment:production test', expectedQuery: {query: 'test'}},
    ];

    list.forEach(item => {
      component.instance().handleSearch(item.searchTerm);
      expect(browserHistory.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: item.expectedQuery,
        })
      );
    });
  });

  it('can change environment', function() {
    const component = shallow(
      <GroupEvents
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        location={{query: {}}}
        environment={TestStubs.Environments()[0]}
      />,
      {
        context: {...TestStubs.router(), group: TestStubs.Group()},
        childContextTypes: {
          router: PropTypes.object,
        },
      }
    );
    component.setProps({environment: TestStubs.Environments()[1]});
  });
});
