import React from 'react';
import {shallow} from 'enzyme';

import GroupStore from 'app/stores/groupStore';
import StreamGroup from 'app/components/stream/group';

// jest.mock('app/mixins/projectState');

describe('StreamGroup', function() {
  let sandbox;
  let GROUP_1;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    GROUP_1 = TestStubs.Group({
      id: '1337',
      project: {
        id: '13',
        slug: 'test',
      },
      type: 'error',
    });
    sandbox.stub(GroupStore, 'get').returns(GROUP_1);
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders with anchors', function() {
    let component = shallow(
      <StreamGroup
        id="1L"
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
        hasGuideAnchor={true}
      />
    );

    expect(component.find('GuideAnchor').exists()).toBe(true);
    expect(component.find('GuideAnchor')).toHaveLength(3);
    expect(component).toMatchSnapshot();
  });
});
