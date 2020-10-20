import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import GroupTagValues from 'app/views/organizationGroupDetails/groupTagValues';
import DetailedError from 'app/components/errors/detailedError';

describe('GroupTagValues', () => {
  const {routerContext, router} = initializeOrg({});
  const group = TestStubs.Group();
  const tags = TestStubs.Tags();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/',
      body: tags.find(({key}) => key === 'user'),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('navigates to issue details events tab with correct query params', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/values/',
      body: TestStubs.TagValues(),
    });
    const wrapper = mountWithTheme(
      <GroupTagValues
        group={group}
        location={{query: {}}}
        params={{orgId: 'org-slug', groupId: group.id, tagKey: 'user'}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('Link').first().simulate('click', {button: 0});

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/',
      query: {query: 'user.username:david'},
    });
  });

  it('renders an error message if no tag values are returned because of environment selection', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/1/tags/user/values/',
      body: [],
    });
    const wrapper = mountWithTheme(
      <GroupTagValues
        group={group}
        location={{query: {}}}
        params={{
          orgId: 'org-slug',
          groupId: group.id,
          tagKey: 'user',
        }}
        environments={['staging']}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find(DetailedError)).toHaveLength(1);
  });
});
