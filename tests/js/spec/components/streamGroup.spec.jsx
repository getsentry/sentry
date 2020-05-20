import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import GroupStore from 'app/stores/groupStore';
import StreamGroup from 'app/components/stream/group';

// jest.mock('app/mixins/projectState');

describe('StreamGroup', function() {
  let GROUP_1;

  beforeEach(function() {
    GROUP_1 = TestStubs.Group({
      id: '1337',
      project: {
        id: '13',
        slug: 'test',
      },
      type: 'error',
    });
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);
  });

  afterEach(function() {});

  it('renders with anchors', function() {
    const component = shallow(
      <StreamGroup
        id="1L"
        orgId="orgId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
        hasGuideAnchor
      />
    );

    expect(component.find('GuideAnchor').exists()).toBe(true);
    expect(component.find('GuideAnchor')).toHaveLength(1);
    expect(component).toMatchSnapshot();
  });
});
