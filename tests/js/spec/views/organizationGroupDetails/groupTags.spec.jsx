import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mount} from 'enzyme';
import GroupTags from 'app/views/organizationGroupDetails/groupTags';

describe('GroupTags', function() {
  const {routerContext, router} = initializeOrg();
  const group = TestStubs.Group();

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/?&environment=dev',
      body: TestStubs.Tags(),
    });
  });

  it('navigates to issue details events tab with correct query params', function() {
    const wrapper = mount(
      <GroupTags
        group={group}
        query={{}}
        environments={['dev']}
        params={{orgId: 'org-slug', groupId: group.id}}
      />,
      routerContext
    );

    wrapper
      .find('li[data-test-id="user"] Link')
      .first()
      .simulate('click', {button: 0});

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/1/events/',
      query: {query: 'user.username:david'},
    });
  });
});
