/* eslint-env jest */
import React from 'react';
import PropTypes from 'prop-types';

import {mount, shallow} from 'enzyme';

import GroupMergedView from 'app/views/groupMerged/groupMergedView';
import {Client} from 'app/api';
import events from '../../mocks/events';

jest.mock('app/api');
jest.mock('app/mixins/projectState', () => {
  return {
    getFeatures: () => new Set([]),
  };
});

const mockData = {
  merged: [
    {
      latestEvent: events[0],
      state: 'unlocked',
      id: '2c4887696f708c476a81ce4e834c4b02',
    },
    {
      latestEvent: events[1],
      state: 'unlocked',
      id: 'e05da55328a860b21f62e371f0a7507d',
    },
  ],
};

describe('Issues -> Merged View', function() {
  let context = {
    group: {
      id: 'id',
      tags: [],
    },
  };
  beforeAll(function() {
    Client.addMockResponse({
      url: '/issues/groupId/hashes/?limit=50&query=',
      body: mockData.merged,
    });
  });

  it('renders initially with loading component', function() {
    let component = shallow(
      <GroupMergedView
        params={{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
        location={{query: {}}}
      />,
      TestStubs.routerContext()
    );

    expect(component).toMatchSnapshot();
  });

  it('renders with mocked data', function(done) {
    let wrapper = mount(
      <GroupMergedView
        params={{orgId: 'orgId', projectId: 'projectId', groupId: 'groupId'}}
        location={{query: {}}}
      />,
      TestStubs.routerContext([
        {
          group: context,
        },
        {
          group: PropTypes.object,
        },
      ])
    );

    wrapper.instance().componentDidUpdate = jest.fn(() => {
      if (!wrapper.state('loading')) {
        wrapper.update();
        expect(wrapper).toMatchSnapshot();
        done();
      }
    });
  });
});
