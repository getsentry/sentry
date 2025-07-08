import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import InstanceLevelOAuthDetails from './instanceLevelOAuthDetails';

describe('instance level OAuth client details', function () {
  const mockClientDetails = {
    name: 'CodeCov',
    clientID: 'e535bb78-706c-4c3d-816c-95b4d9bc8a04eda5aa18-9ea2-44b2-af38-664512b911b9',
    createdAt: '2022-04-28 00:00:00.000',
    allowedOrigins: ['https://fakecodecov.io/'],
    redirectUris: ['https://fakecodecov.io/redirect'],
    homepageUrl: 'https://fakecodecov.io/homepage',
    privacyUrl: 'https://fakecodecov.io/privacy',
    termsUrl: 'https://fakecodecov.io/terms',
  };

  const newClientDetails = {
    clientID: mockClientDetails.clientID,
    name: 'New Name',
    allowedOrigins: 'https://new-origin.com',
    redirectUris: 'https://new-redirect.com',
    homepageUrl: 'https://new-home.com',
    privacyUrl: 'https://new-privacy.com',
    termsUrl: 'https://new-terms.com',
  };

  const initialRouterConfig = {
    location: {
      pathname: `/_admin/instance-level-oauth/${mockClientDetails.clientID}/`,
    },
    route: '/_admin/instance-level-oauth/:clientID/',
  };
  let mockGetDetailsCall: jest.Mock;
  let mockDeleteCall: jest.Mock;
  let mockPutCall: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockGetDetailsCall = MockApiClient.addMockResponse({
      url: `/_admin/instance-level-oauth/${mockClientDetails.clientID}/`,
      method: 'GET',
      body: mockClientDetails,
    });

    mockDeleteCall = MockApiClient.addMockResponse({
      url: `/_admin/instance-level-oauth/${mockClientDetails.clientID}/`,
      method: 'DELETE',
    });

    mockPutCall = MockApiClient.addMockResponse({
      url: `/_admin/instance-level-oauth/${mockClientDetails.clientID}/`,
      method: 'PUT',
      body: newClientDetails,
    });
  });

  it('renders client details properly', async function () {
    render(<InstanceLevelOAuthDetails />, {
      initialRouterConfig,
    });
    expect(
      await screen.findByText('Details For Instance Level OAuth Client: CodeCov')
    ).toBeInTheDocument();
    expect(await screen.findByText('Client Name')).toBeInTheDocument();
    expect(
      await screen.findByText('Allowed Origins (space separated)')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Redirect URIs (space separated)')
    ).toBeInTheDocument();
    expect(await screen.findByText('Homepage URL')).toBeInTheDocument();
    expect(await screen.findByText('Privacy Policy URL')).toBeInTheDocument();
    expect(await screen.findByText('Terms and Conditions URL')).toBeInTheDocument();

    expect(screen.getByDisplayValue(mockClientDetails.name)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockClientDetails.clientID)).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(mockClientDetails.allowedOrigins[0]!)
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(mockClientDetails.redirectUris[0]!)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockClientDetails.homepageUrl)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockClientDetails.privacyUrl)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockClientDetails.termsUrl)).toBeInTheDocument();

    expect(mockGetDetailsCall).toHaveBeenCalledTimes(1);
  });

  it('allows a client to be updated', async function () {
    render(<InstanceLevelOAuthDetails />, {
      initialRouterConfig,
    });

    // Wait for page load then clear current client details
    await screen.findByText('Details For Instance Level OAuth Client: CodeCov');
    await userEvent.clear(screen.getByDisplayValue(mockClientDetails.name));
    await userEvent.clear(screen.getByDisplayValue(mockClientDetails.allowedOrigins[0]!));
    await userEvent.clear(screen.getByDisplayValue(mockClientDetails.redirectUris[0]!));
    await userEvent.clear(screen.getByDisplayValue(mockClientDetails.homepageUrl));
    await userEvent.clear(screen.getByDisplayValue(mockClientDetails.privacyUrl));
    await userEvent.clear(screen.getByDisplayValue(mockClientDetails.termsUrl));

    // Set new client details and submit
    await userEvent.type(
      screen.getByPlaceholderText('e.g. CodeCov'),
      newClientDetails.name
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. https://notsentry.io/redirect'),
      newClientDetails.redirectUris
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. https://notsentry.io/origin'),
      newClientDetails.allowedOrigins
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. https://notsentry.io/home'),
      newClientDetails.homepageUrl
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. https://notsentry.io/terms'),
      newClientDetails.termsUrl
    );
    await userEvent.type(
      screen.getByPlaceholderText('e.g. https://notsentry.io/privacy'),
      newClientDetails.privacyUrl
    );

    await userEvent.click(screen.getByRole('button', {name: 'Save Client Settings'}));
    expect(mockPutCall).toHaveBeenCalledTimes(1);
    const submittedPutRequestBody = mockPutCall.mock.calls[0][1].data;
    expect(submittedPutRequestBody).toEqual(newClientDetails);
  });

  it('deletes a client correctly', async function () {
    render(<InstanceLevelOAuthDetails />, {
      initialRouterConfig,
    });
    await userEvent.click(await screen.findByRole('button', {name: 'Delete client'}));
    renderGlobalModal();
    expect(await screen.findByText('Delete client')).toBeVisible();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Permanently and Irreversibly Delete Client',
      })
    );
    expect(mockDeleteCall).toHaveBeenCalledTimes(1);
  });
});
