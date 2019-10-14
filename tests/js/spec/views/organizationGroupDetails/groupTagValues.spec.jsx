import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mount} from 'sentry-test/enzyme';
import GroupTagValues from 'app/views/organizationGroupDetails/groupTagValues';

describe('GroupTagValues', function() {
  const {routerContext, router} = initializeOrg({});
  const group = TestStubs.Group();
  const tags = TestStubs.Tags();

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/',
      body: tags.find(({key}) => key === 'user'),
    });
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/values/',
      body: TestStubs.TagValues(),
    });
  });

  it('navigates to issue details events tab with correct query params', async function() {
    const wrapper = mount(
      <GroupTagValues
        group={group}
        query={{}}
        params={{orgId: 'org-slug', groupId: group.id, tagKey: 'user'}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper
      .find('Link')
      .first()
      .simulate('click', {button: 0});

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/',
      query: {query: 'user.username:david'},
    });
  });
});
