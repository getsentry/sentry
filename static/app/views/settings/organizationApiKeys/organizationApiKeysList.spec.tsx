import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeysList from 'sentry/views/settings/organizationApiKeys/organizationApiKeysList';

jest.unmock('sentry/utils/recreateRoute');

describe('OrganizationApiKeysList', function () {
  it('opens a modal when trying to delete a key', async function () {
    const routes = [
      {path: '/'},
      {path: '/:orgId/'},
      {path: '/organizations/:orgId/'},
      {path: 'api-keys/', name: 'API Key'},
    ];

    const {organization, router, route} = initializeOrg({
      router: {routes},
    });

    render(
      <OrganizationApiKeysList
        organization={organization}
        params={{}}
        routes={routes}
        keys={[TestStubs.ApiKey()]}
        router={router}
        routeParams={{}}
        route={route}
        busy={false}
        loading={false}
        location={router.location}
        onRemove={jest.fn()}
        onAddApiKey={jest.fn()}
      />
    );

    // Click remove button
    await userEvent.click(await screen.findByTitle('Remove API Key?'));

    // expect a modal
    renderGlobalModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
