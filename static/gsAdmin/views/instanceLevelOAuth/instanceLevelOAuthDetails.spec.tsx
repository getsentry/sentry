import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';

import {InstanceLevelOAuthDetails} from './instanceLevelOAuthDetails';

describe('instance level OAuth client details', () => {
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

  it('renders client details properly', async () => {
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

  it('shows an error when client details cannot be loaded', async () => {
    jest.spyOn(indicators, 'addErrorMessage');
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/_admin/instance-level-oauth/${mockClientDetails.clientID}/`,
      method: 'GET',
      statusCode: 500,
    });

    render(<InstanceLevelOAuthDetails />, {initialRouterConfig});

    await waitFor(() =>
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Unable to load client data'
      )
    );
    expect(
      screen.queryByRole('button', {name: 'Save Client Settings'})
    ).not.toBeInTheDocument();
  });

  it('allows a client to be updated', async () => {
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

    const refreshedGetCall = MockApiClient.addMockResponse({
      url: `/_admin/instance-level-oauth/${mockClientDetails.clientID}/`,
      method: 'GET',
      body: {...mockClientDetails, name: newClientDetails.name},
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save Client Settings'}));
    expect(mockPutCall).toHaveBeenCalledTimes(1);
    const submittedPutRequestBody = mockPutCall.mock.calls[0][1].data;
    expect(submittedPutRequestBody).toEqual(newClientDetails);
    expect(
      await screen.findByText('Details For Instance Level OAuth Client: New Name')
    ).toBeInTheDocument();
    expect(refreshedGetCall).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid URLs', async () => {
    render(<InstanceLevelOAuthDetails />, {initialRouterConfig});
    await screen.findByText('Details For Instance Level OAuth Client: CodeCov');

    await userEvent.clear(screen.getByRole('textbox', {name: 'Homepage URL'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Homepage URL'}), 'invalid');
    await userEvent.click(screen.getByRole('button', {name: 'Save Client Settings'}));

    expect(await screen.findByText('Enter a valid URL')).toBeInTheDocument();
    expect(mockPutCall).not.toHaveBeenCalled();
  });

  it('shows server validation errors on the affected fields', async () => {
    MockApiClient.addMockResponse({
      url: `/_admin/instance-level-oauth/${mockClientDetails.clientID}/`,
      method: 'PUT',
      statusCode: 400,
      body: {name: ['This client name is already in use.']},
    });

    render(<InstanceLevelOAuthDetails />, {initialRouterConfig});
    await screen.findByRole('button', {name: 'Save Client Settings'});
    await userEvent.click(screen.getByRole('button', {name: 'Save Client Settings'}));

    expect(
      await screen.findByText('This client name is already in use.')
    ).toBeInTheDocument();
  });

  it('rejects comma-separated URLs', async () => {
    render(<InstanceLevelOAuthDetails />, {initialRouterConfig});
    await screen.findByText('Details For Instance Level OAuth Client: CodeCov');

    await userEvent.clear(
      screen.getByRole('textbox', {name: 'Redirect URIs (space separated)'})
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Redirect URIs (space separated)'}),
      'https://example.com/one,https://example.com/two'
    );
    await userEvent.clear(
      screen.getByRole('textbox', {name: 'Allowed Origins (space separated)'})
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Allowed Origins (space separated)'}),
      'https://example.com/one, https://example.com/two'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Save Client Settings'}));

    expect(
      await screen.findByText('Enter valid redirect URLs separated by spaces')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Enter valid allowed origins separated by spaces')
    ).toBeInTheDocument();
    expect(mockPutCall).not.toHaveBeenCalled();
  });

  it('deletes a client correctly', async () => {
    render(<InstanceLevelOAuthDetails />, {
      initialRouterConfig,
    });
    await userEvent.click(await screen.findByRole('button', {name: 'Delete client'}));
    renderGlobalModal();
    expect(
      await screen.findByRole('heading', {name: /Delete client:/})
    ).toBeInTheDocument();
    const deleteButton = await screen.findByRole('button', {
      name: 'Permanently and Irreversibly Delete Client',
    });
    expect(deleteButton.closest('footer')).toBeInTheDocument();
    await userEvent.click(deleteButton);
    expect(mockDeleteCall).toHaveBeenCalledTimes(1);
  });
});
