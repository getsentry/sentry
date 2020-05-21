import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import OrganizationRepositories from 'app/views/settings/organizationRepositories/organizationRepositories';

describe('OrganizationRepositories', function() {
  it('renders without providers', function() {
    const wrapper = shallow(
      <OrganizationRepositories
        params={{orgId: 'org-slug'}}
        itemList={[]}
        repoConfig={{}}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with github provider', function() {
    const wrapper = shallow(
      <OrganizationRepositories
        params={{orgId: 'org-slug'}}
        repoConfig={{providers: [TestStubs.GitHubRepositoryProvider({id: 'github'})]}}
        itemList={[]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with a repository', function() {
    Client.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: [TestStubs.Repository()],
    });
    const wrapper = shallow(
      <OrganizationRepositories
        api={new Client()}
        params={{orgId: 'org-slug'}}
        repoConfig={{providers: [TestStubs.GitHubRepositoryProvider({id: 'github'})]}}
        itemList={[TestStubs.Repository()]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
