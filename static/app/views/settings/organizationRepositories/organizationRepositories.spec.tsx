import {render} from 'sentry-test/reactTestingLibrary';

import OrganizationRepositories from 'sentry/views/settings/organizationRepositories/organizationRepositories';

describe('OrganizationRepositories', function () {
  const org = TestStubs.Organization();
  const router = TestStubs.router();
  const location = router.location;

  const routerProps = {router, location, routeParams: {}, routes: [], route: {}};

  it('renders without providers', function () {
    render(
      <OrganizationRepositories
        onRepositoryChange={jest.fn()}
        organization={org}
        itemList={[]}
        {...routerProps}
      />
    );
  });

  it('renders with a repository', function () {
    render(
      <OrganizationRepositories
        onRepositoryChange={jest.fn()}
        organization={org}
        itemList={[TestStubs.Repository()]}
        {...routerProps}
      />
    );
  });

  it('renders with a repository and github provider', function () {
    render(
      <OrganizationRepositories
        onRepositoryChange={jest.fn()}
        organization={org}
        itemList={[
          TestStubs.Repository({
            provider: {id: 'github', name: 'GitHub'},
          }),
        ]}
        {...routerProps}
      />
    );
  });
});
