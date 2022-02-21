import {mountGlobalModal} from 'sentry-test/modal';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeysList from 'sentry/views/settings/organizationApiKeys/organizationApiKeysList';

jest.unmock('sentry/utils/recreateRoute');

const routes = [
  {path: '/'},
  {path: '/:orgId/'},
  {path: '/organizations/:orgId/'},
  {path: 'api-keys/', name: 'API Key'},
];

describe('OrganizationApiKeysList', function () {
  it('opens a modal when trying to delete a key', async function () {
    mountWithTheme(
      <OrganizationApiKeysList
        params={{orgId: 'org-slug'}}
        routes={routes}
        keys={[TestStubs.ApiKey()]}
      />,
      {context: TestStubs.routerContext()}
    );

    // Click remove button
    (await screen.findByTitle('Remove API Key?')).click();

    // expect a modal
    const modal = await mountGlobalModal();
    expect(modal.find('GlobalModal[visible=true]').exists()).toBe(true);
  });
});
