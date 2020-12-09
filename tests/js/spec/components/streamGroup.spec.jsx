import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import StreamGroup from 'app/components/stream/group';
import GroupStore from 'app/stores/groupStore';

describe('StreamGroup', function () {
  let GROUP_1;

  beforeEach(function () {
    GROUP_1 = TestStubs.Group({
      id: '1337',
      project: {
        id: '13',
        slug: 'foo-project',
      },
      type: 'error',
      inbox: {
        date_added: '2020-11-24T13:17:42.248751Z',
        reason: 0,
        reason_details: null,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });
    jest.spyOn(GroupStore, 'get').mockImplementation(() => GROUP_1);
  });

  afterEach(function () {});

  it('renders with anchors', function () {
    const {routerContext} = initializeOrg();
    const component = mountWithTheme(
      <StreamGroup
        id="1L"
        orgId="orgId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
        hasGuideAnchor
        {...routerContext}
      />,
      routerContext
    );

    expect(component.find('GuideAnchor').exists()).toBe(true);
    expect(component.find('GuideAnchor')).toHaveLength(3);
    expect(component).toSnapshot();
  });

  it('marks as reviewed while on inbox tab', function () {
    const {routerContext, organization} = initializeOrg({
      organization: {
        features: ['inbox'],
      },
    });
    const wrapper = mountWithTheme(
      <StreamGroup
        id="1337"
        orgId="orgId"
        groupId="groupId"
        lastSeen="2017-07-25T22:56:12Z"
        firstSeen="2017-07-01T02:06:02Z"
        query="is:needs_review is:unresolved"
        organization={organization}
        {...routerContext}
      />,
      routerContext
    );

    expect(wrapper).toSnapshot();
    const streamGroup = wrapper.find('StreamGroup');
    expect(streamGroup.state('reviewed')).toBe(false);
    GROUP_1.inbox = false;
    streamGroup.instance().onGroupChange(new Set(['1337']));
    expect(streamGroup.state('reviewed')).toBe(true);
  });
});
