import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import GroupTags from 'app/views/organizationGroupDetails/groupTags';

describe('GroupTags', function() {
  const {routerContext, router, organization} = initializeOrg();
  const group = TestStubs.Group();
  let tagsMock;
  beforeEach(function() {
    tagsMock = MockApiClient.addMockResponse({
      url: '/issues/1/tags/',
      body: TestStubs.Tags(),
    });
  });

  it('navigates to issue details events tab with correct query params', function() {
    const wrapper = mountWithTheme(
      <GroupTags
        group={group}
        query={{}}
        environments={['dev']}
        params={{orgId: 'org-slug', groupId: group.id}}
        baseUrl={`/organizations/${organization.slug}/issues/${group.id}/`}
      />,
      routerContext
    );

    expect(tagsMock).toHaveBeenCalledWith(
      '/issues/1/tags/',
      expect.objectContaining({
        query: {environment: ['dev']},
      })
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
