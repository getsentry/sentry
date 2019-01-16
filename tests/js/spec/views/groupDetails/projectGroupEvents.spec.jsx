import React from 'react';
import PropTypes from 'prop-types';
import {shallow} from 'enzyme';
import {browserHistory} from 'react-router';

import {GroupEvents} from 'app/views/groupDetails/project/groupEvents';

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
        group={TestStubs.Group()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        location={{query: {}}}
      />,
      {
        context: TestStubs.router(),
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
        group={TestStubs.Group()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        location={{query: {}}}
      />,
      {
        context: TestStubs.router(),
        childContextTypes: {
          router: PropTypes.object,
        },
      }
    );

    const list = [
      {searchTerm: '', expectedQuery: ''},
      {searchTerm: 'test', expectedQuery: 'test'},
      {searchTerm: 'environment:production test', expectedQuery: 'test'},
    ];

    list.forEach(item => {
      component.instance().handleSearch(item.searchTerm);
      expect(browserHistory.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {query: item.expectedQuery},
        })
      );
    });
  });

  describe('changing environment', function() {
    let component, eventsMock;
    beforeEach(function() {
      component = shallow(
        <GroupEvents
          group={TestStubs.Group()}
          params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
          location={{query: {}}}
          environment={TestStubs.Environments()[0]}
        />,
        {
          context: TestStubs.router(),
          childContextTypes: {
            router: PropTypes.object,
          },
        }
      );

      eventsMock = MockApiClient.addMockResponse({
        url: '/issues/1/events/',
      });
    });
    it('select environment', function() {
      component.setProps({environment: TestStubs.Environments()[1]});
      expect(eventsMock.mock.calls[0][1].query.environment).toEqual('staging');
    });

    it('select all environments', function() {
      component.setProps({environment: null});
      expect(eventsMock.mock.calls[0][1].query.environment).toEqual(undefined);
    });
  });
});
