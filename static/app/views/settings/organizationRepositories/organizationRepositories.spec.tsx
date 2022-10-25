import {render} from 'sentry-test/reactTestingLibrary';

import OrganizationRepositories from 'sentry/views/settings/organizationRepositories/organizationRepositories';

describe('OrganizationRepositories', function () {
  const router = TestStubs.router();
  const location = router.location;

  const routerProps = {router, location, routeParams: {}, routes: [], route: {}};

  it('renders without providers', function () {
    const {container} = render(
      <OrganizationRepositories
        onRepositoryChange={jest.fn()}
        params={{orgId: 'org-slug'}}
        itemList={[]}
        {...routerProps}
      />
    );
    expect(container).toSnapshot();
  });

  it('renders with a repository', function () {
    const {container} = render(
      <OrganizationRepositories
        onRepositoryChange={jest.fn()}
        params={{orgId: 'org-slug'}}
        itemList={[TestStubs.Repository()]}
        {...routerProps}
      />
    );
    expect(container).toSnapshot();
  });

  it('renders with a repository and github provider', function () {
    const {container} = render(
      <OrganizationRepositories
        onRepositoryChange={jest.fn()}
        params={{orgId: 'org-slug'}}
        itemList={[
          TestStubs.Repository({
            provider: TestStubs.GitHubRepositoryProvider({id: 'github'}),
          }),
        ]}
        {...routerProps}
      />
    );
    expect(container).toSnapshot();
  });
});
