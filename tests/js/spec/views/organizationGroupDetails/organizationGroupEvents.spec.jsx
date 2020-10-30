import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router';

import {shallow, mountWithTheme} from 'sentry-test/enzyme';

import {GroupEvents} from 'app/views/organizationGroupDetails/groupEvents';

const OrganizationGroupEvents = GroupEvents;

describe('groupEvents', function () {
  let request;
  const routerContext = TestStubs.routerContext();

  beforeEach(function () {
    request = MockApiClient.addMockResponse({
      url: '/issues/1/events/',
      body: [
        TestStubs.Event({
          eventID: '12345',
          id: '1',
          message: 'ApiException',
          groupID: '1',
        }),
        TestStubs.Event({
          crashFile: {
            sha1: 'sha1',
            name: 'name.dmp',
            dateCreated: '2019-05-21T18:01:48.762Z',
            headers: {'Content-Type': 'application/octet-stream'},
            id: '12345',
            size: 123456,
            type: 'event.minidump',
          },
          culprit: '',
          dateCreated: '2019-05-21T18:00:23Z',
          'event.type': 'error',
          eventID: '123456',
          groupID: '1',
          id: '98654',
          location: 'main.js',
          message: 'TestException',
          platform: 'native',
          projectID: '123',
          tags: [{value: 'production', key: 'production'}],
          title: 'TestException',
        }),
      ],
    });

    browserHistory.push = jest.fn();
  });

  it('renders', function () {
    const component = mountWithTheme(
      <OrganizationGroupEvents
        api={new MockApiClient()}
        group={TestStubs.Group()}
        params={{orgId: 'orgId', projectId: 'projectId', groupId: '1'}}
        location={{query: {}}}
      />,
      routerContext
    );

    expect(component).toSnapshot();
  });

  it('handles search', function () {
    const component = shallow(
      <OrganizationGroupEvents
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

  it('handles environment filtering', function () {
    shallow(
      <OrganizationGroupEvents
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
