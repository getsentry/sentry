import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {OrgAuthToken} from 'sentry/types';
import {OrganizationAuthTokensNewAuthToken} from 'sentry/views/settings/organizationAuthTokens/newAuthToken';

describe('OrganizationAuthTokensNewAuthToken', function () {
  const ENDPOINT = '/organizations/org-slug/org-auth-tokens/';
  const {organization, router} = initializeOrg();

  const defaultProps = {
    organization,
    router,
    location: router.location,
    params: {orgId: organization.slug},
    routes: router.routes,
    route: {},
    routeParams: router.params,
  };

  beforeEach(function () {
    OrganizationsStore.addOrReplace(organization);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('can create token', async function () {
    render(<OrganizationAuthTokensNewAuthToken {...defaultProps} />);

    const generatedToken: OrgAuthToken & {token: string} = {
      id: '1',
      name: 'My Token',
      token: 'sntrys_XXXXXXX',
      tokenLastCharacters: 'XXXX',
      dateCreated: new Date('2023-01-01T00:00:00.000Z'),
      scopes: ['org:read'],
    };

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      body: generatedToken,
    });

    expect(screen.queryByLabelText('Generated token')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'My Token');
    await userEvent.click(screen.getByRole('button', {name: 'Create Auth Token'}));

    expect(screen.getByLabelText('Generated token')).toHaveValue('sntrys_XXXXXXX');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        data: {name: 'My Token'},
      })
    );
  });

  it('handles API errors when creating token', async function () {
    jest.spyOn(indicators, 'addErrorMessage');

    render(<OrganizationAuthTokensNewAuthToken {...defaultProps} />);

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      body: {
        detail: 'Test API error occurred.',
      },
      statusCode: 400,
    });

    expect(screen.queryByLabelText('Generated token')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'My Token');
    await userEvent.click(screen.getByRole('button', {name: 'Create Auth Token'}));

    expect(screen.queryByLabelText('Generated token')).not.toBeInTheDocument();

    expect(indicators.addErrorMessage).toHaveBeenCalledWith(
      'Failed to create a new auth token.'
    );

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        data: {name: 'My Token'},
      })
    );
  });

  it('handles missing_system_url_prefix API error when creating token', async function () {
    jest.spyOn(indicators, 'addErrorMessage');

    render(<OrganizationAuthTokensNewAuthToken {...defaultProps} />);

    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'POST',
      body: {
        detail: {message: 'test message', code: 'missing_system_url_prefix'},
      },
      statusCode: 400,
    });

    expect(screen.queryByLabelText('Generated token')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'My Token');
    await userEvent.click(screen.getByRole('button', {name: 'Create Auth Token'}));

    expect(screen.queryByLabelText('Generated token')).not.toBeInTheDocument();

    expect(indicators.addErrorMessage).toHaveBeenCalledWith(
      'You have to configure `system.url-prefix` in your Sentry instance in order to generate tokens.'
    );

    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        data: {name: 'My Token'},
      })
    );
  });
});
