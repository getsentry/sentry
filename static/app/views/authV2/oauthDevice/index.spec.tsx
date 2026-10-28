import {OAuthContextFixture} from 'sentry-fixture/oauth';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {mockElementFromPoint} from 'sentry/views/authV2/authLogin/components/testUtils';
import {waitForAuthorization} from 'sentry/views/authV2/oauth/testUtils';

import OAuthDevice from '.';

jest.setTimeout(15000);

const location = {pathname: '/oauth/device/', query: {user_code: 'ABCD-EFGH'}};
const consent = {stage: 'consent', userCode: 'ABCD-EFGH', organizationOptions: []};

describe('OAuthDevice', () => {
  mockElementFromPoint();
  const originalConfig = ConfigStore.getState();
  beforeEach(() => {
    ConfigStore.set('user', UserFixture());
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/context/',
      body: {...OAuthContextFixture(), userCode: 'ABCD-EFGH'},
    });
    MockApiClient.addMockResponse({url: '/auth/oauth/device/', body: consent});
  });
  afterEach(() => ConfigStore.loadInitialData(originalConfig));

  it('keeps code entry disabled until consent is ready', async () => {
    const contextDelay = Promise.withResolvers<void>();
    const consentDelay = Promise.withResolvers<void>();
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/context/',
      body: {...OAuthContextFixture(), userCode: 'ABCD-EFGH'},
      asyncDelay: contextDelay.promise,
    });
    const prepareConsent = MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: consent,
      asyncDelay: consentDelay.promise,
    });
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/context/',
      body: {stage: 'codeEntry'},
      match: [MockApiClient.matchQuery({user_code: ''})],
    });
    const {router} = render(<OAuthDevice />, {
      initialRouterConfig: {location: {pathname: '/oauth/device/'}},
    });
    const input = await screen.findByRole('textbox', {name: 'Device code'});
    await userEvent.click(input);
    await userEvent.paste('abcd-efgh');
    expect(input).toBeDisabled();
    expect(input).toHaveValue('ABCDEFGH');
    expect(router.location.query).toEqual({});
    await act(() => {
      contextDelay.resolve();
      return contextDelay.promise;
    });
    await waitFor(() => expect(prepareConsent).toHaveBeenCalled());
    expect(screen.getByRole('textbox', {name: 'Device code'})).toBe(input);
    expect(input).toBeDisabled();
    await act(() => {
      consentDelay.resolve();
      return consentDelay.promise;
    });
    await waitForAuthorization();
    expect(await screen.findByText('ABCD-EFGH')).toBeVisible();
  });

  it('requires explicit approval and shows completion without navigating', async () => {
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      method: 'POST',
      body: {stage: 'approved'},
    });
    render(<OAuthDevice />, {initialRouterConfig: {location}});
    await waitForAuthorization();
    expect(approve).not.toHaveBeenCalled();
    await userEvent.click(await waitForAuthorization());
    await waitFor(() =>
      expect(
        screen.getByText('Application authorized. Return to your device to continue.')
      ).toBeVisible()
    );
    expect(approve).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {op: 'approve', userCode: 'ABCD-EFGH'}})
    );
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });

  it('shows denied completion', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      method: 'POST',
      body: {stage: 'denied'},
    });
    render(<OAuthDevice />, {initialRouterConfig: {location}});
    await userEvent.click(await screen.findByRole('button', {name: 'Deny'}));
    await waitFor(() =>
      expect(
        screen.getByText('Authorization denied. You can close this window.')
      ).toBeVisible()
    );
  });

  it('preselects the sole eligible organization and sends it with approval', async () => {
    const context = OAuthContextFixture();
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/context/',
      body: {
        ...context,
        application: {...context.application, requiresOrgLevelAccess: true},
        userCode: 'ABCD-EFGH',
      },
    });
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: {
        ...consent,
        organizationOptions: [{id: '1', name: 'Example Org', slug: 'org-slug'}],
      },
    });
    const approve = MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      method: 'POST',
      body: {stage: 'approved'},
    });
    render(<OAuthDevice />, {initialRouterConfig: {location}});
    await userEvent.click(await waitForAuthorization());
    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {op: 'approve', userCode: 'ABCD-EFGH', selectedOrganizationId: '1'},
        })
      )
    );
  });

  it('allows editing an expired code in place', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/context/',
      statusCode: 400,
      body: {detail: 'This code has expired.'},
    });
    render(<OAuthDevice />, {initialRouterConfig: {location}});
    await waitFor(() => expect(screen.getByText('This code has expired.')).toBeVisible());
    const input = screen.getByRole('textbox', {name: 'Device code'});
    expect(input).toBeEnabled();
    expect(input).toHaveValue('ABCDEFGH');
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/context/',
      body: {...OAuthContextFixture(), userCode: 'WXYZ-ABCD'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: {...consent, userCode: 'WXYZ-ABCD'},
    });
    await userEvent.clear(input);
    await userEvent.type(input, 'WXYZABCD');
    await waitForAuthorization();
  });

  it('offers account switching after an organization access error', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      statusCode: 400,
      body: {detail: 'You must be a member of an organization.'},
    });
    MockApiClient.addMockResponse({url: '/auth/', method: 'DELETE', body: {}});
    MockApiClient.addMockResponse({url: '/auth-v2/csrf/', body: {}});
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        pendingMfa: null,
        serverHostname: 'sentry.example.com',
        canRegister: false,
        hasNewsletter: false,
      },
    });
    render(<OAuthDevice />, {initialRouterConfig: {location}});
    await waitFor(() =>
      expect(screen.getByText('You must be a member of an organization.')).toBeVisible()
    );
    await userEvent.click(screen.getByRole('button', {name: 'Switch account'}));
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Email'})).toBeVisible()
    );
  });

  it('keeps the device context visible through pending MFA and prepares again', async () => {
    MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      statusCode: 403,
      body: {detail: 'Authentication credentials were not provided.'},
    });
    MockApiClient.addMockResponse({
      url: '/auth/config/',
      body: {
        pendingMfa: {mfaRequired: true, mfaMethods: [{id: 'totp'}]},
        serverHostname: 'sentry.example.com',
        canRegister: false,
        hasNewsletter: false,
      },
    });
    MockApiClient.addMockResponse({
      url: '/auth/2fa/',
      method: 'POST',
      body: {user: UserFixture(), nextUri: '/elsewhere/'},
    });
    render(<OAuthDevice />, {initialRouterConfig: {location}});
    const input = await screen.findByRole('textbox', {name: 'One-time password'});
    await waitFor(() => expect(screen.getByText('Example Application')).toBeVisible());
    const prepare = MockApiClient.addMockResponse({
      url: '/auth/oauth/device/',
      body: consent,
    });
    await userEvent.type(input, '123456');
    await waitForAuthorization();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();
  });
});
