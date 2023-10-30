import {DeprecatedApiKey} from 'sentry-fixture/deprecatedApiKey';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {RouteWithName} from 'sentry/views/settings/components/settingsBreadcrumb/types';
import OrganizationApiKeys from 'sentry/views/settings/organizationApiKeys';

const routes: RouteWithName[] = [
  {path: '/'},
  {path: '/:orgId/'},
  {path: '/organizations/:orgId/'},
  {path: 'api-keys/', name: 'API Key'},
];

describe('OrganizationApiKeys', function () {
  const {routerProps} = initializeOrg();
  let getMock: jest.Mock;
  let deleteMock: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    getMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/',
      method: 'GET',
      body: [DeprecatedApiKey()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: DeprecatedApiKey(),
    });
    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'DELETE',
    });
  });

  it('fetches api keys', function () {
    render(<OrganizationApiKeys {...routerProps} routes={routes} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('can delete a key', async function () {
    render(<OrganizationApiKeys {...routerProps} routes={routes} />);

    expect(deleteMock).toHaveBeenCalledTimes(0);
    await userEvent.click(screen.getByRole('link', {name: 'Remove API Key?'}));

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
