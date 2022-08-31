import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import OrganizationApiKeys from 'sentry/views/settings/organizationApiKeys';

const routes = [
  {path: '/'},
  {path: '/:orgId/'},
  {path: '/organizations/:orgId/'},
  {path: 'api-keys/', name: 'API Key'},
];

describe('OrganizationApiKeys', function () {
  let getMock, deleteMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/',
      method: 'GET',
      body: [TestStubs.ApiKey()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.ApiKey(),
    });
    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'DELETE',
    });
  });

  it('fetches api keys', function () {
    const wrapper = mountWithTheme(
      <OrganizationApiKeys
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />
    );

    expect(wrapper.find('AutoSelectTextInput')).toHaveLength(1);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('can delete a key', async function () {
    const wrapper = mountWithTheme(
      <OrganizationApiKeys
        location={TestStubs.location()}
        params={{orgId: 'org-slug'}}
        routes={routes}
      />
    );

    expect(deleteMock).toHaveBeenCalledTimes(0);
    wrapper.find('Confirm[aria-label="Remove API Key"]').simulate('click');

    const modal = await mountGlobalModal();
    modal.find('button[aria-label="Confirm"]').simulate('click');

    wrapper.update();

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('AutoSelectTextInput')).toHaveLength(0);
  });
});
