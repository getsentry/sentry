import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationRepositories from 'app/views/settings/organizationRepositories/organizationRepositories';

describe('OrganizationRepositories', function() {
  it('renders without providers', function() {
    const wrapper = mountWithTheme(
      <OrganizationRepositories
        params={{orgId: 'org-slug'}}
        itemList={[]}
        repoConfig={{}}
      />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders with github provider', function() {
    const wrapper = mountWithTheme(
      <OrganizationRepositories
        params={{orgId: 'org-slug'}}
        repoConfig={{providers: [TestStubs.GitHubRepositoryProvider({id: 'github'})]}}
        itemList={[]}
      />
    );
    expect(wrapper).toSnapshot();
  });

  it('renders with a repository', function() {
    Client.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: [TestStubs.Repository()],
    });
    const wrapper = mountWithTheme(
      <OrganizationRepositories
        api={new Client()}
        params={{orgId: 'org-slug'}}
        repoConfig={{providers: [TestStubs.GitHubRepositoryProvider({id: 'github'})]}}
        itemList={[TestStubs.Repository()]}
      />
    );
    expect(wrapper).toSnapshot();
  });
});
