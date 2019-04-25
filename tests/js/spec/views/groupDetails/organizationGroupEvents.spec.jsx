import React from 'react';
import PropTypes from 'prop-types';
import {shallow} from 'enzyme';
import {browserHistory} from 'react-router';

import {GroupEvents} from 'app/views/groupDetails/organization/groupEvents';

const OrgnanizationGroupEvents = GroupEvents;

describe('groupEvents', function() {
  let request;
  beforeEach(function() {
    request = MockApiClient.addMockResponse({
      url: '/issues/1/events/',
      body: TestStubs.Events(),
    });

    browserHistory.push = jest.fn();
  });

  it('renders', function() {
    const component = shallow(
      <OrgnanizationGroupEvents
        api={new MockApiClient()}
        group={TestStubs.Group()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        location={{query: {}}}
      />,
      {
        context: {...TestStubs.router()},
        childContextTypes: {
          router: PropTypes.object,
        },
      }
    );

    expect(component).toMatchSnapshot();
  });

  it('handles search', function() {
    const component = shallow(
      <OrgnanizationGroupEvents
        api={new MockApiClient()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        group={TestStubs.Group()}
        location={{query: {}}}
      />,
      {
        context: {...TestStubs.router()},
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

  it('handles environment filtering', function() {
    shallow(
      <OrgnanizationGroupEvents
        api={new MockApiClient()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        group={TestStubs.Group()}
        location={{query: {environment: ['prod', 'staging']}}}
      />,
      {
        context: {...TestStubs.router()},
        childContextTypes: {
          router: PropTypes.object,
        },
      }
    );
    expect(request).toHaveBeenCalledWith(
      '/issues/1/events/',
      expect.objectContaining({
        query: {limit: 50, query: '', environment: ['prod', 'staging']},
      })
    );
  });
});
