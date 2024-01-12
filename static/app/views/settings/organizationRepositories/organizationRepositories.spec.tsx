import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render} from 'sentry-test/reactTestingLibrary';

import OrganizationRepositories from 'sentry/views/settings/organizationRepositories/organizationRepositories';

describe('OrganizationRepositories', function () {
  const org = OrganizationFixture();
  const router = RouterFixture();
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
        itemList={[RepositoryFixture()]}
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
          RepositoryFixture({
            provider: {id: 'github', name: 'GitHub'},
          }),
        ]}
        {...routerProps}
      />
    );
  });
});
