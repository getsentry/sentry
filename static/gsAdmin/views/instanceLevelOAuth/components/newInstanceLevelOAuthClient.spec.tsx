import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import InstanceLevelOAuth from 'admin/views/instanceLevelOAuth/instanceLevelOAuth';

describe('create instance level OAuth client', () => {
  let mockPostRequest: jest.Mock;
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/_admin/instance-level-oauth/',
      method: 'GET',
      body: [
        {
          name: 'Earth',
          clientID:
            '3f80974a-d59c-474d-b75f-37a011da09980ee6b8e4-e934-46d4-be0d-b5effcdca1bd',
          dateAdded: '2023-06-07 22:25:58.014042+00',
        },
      ],
    });
    mockPostRequest = MockApiClient.addMockResponse({
      url: '/_admin/instance-level-oauth/',
      method: 'POST',
      body: [],
    });
  });

  it('loads the create client modal', async () => {
    render(<InstanceLevelOAuth />);
    await userEvent.click(screen.getByText('New Instance Level OAuth Client'));
    renderGlobalModal();
    expect(
      screen.getByText('Create New Instance Level OAuth Client')
    ).toBeInTheDocument();
    const textBoxLabels = [
      'Client Name',
      'Allowed Origins',
      'Redirect URIs',
      'Homepage URL',
      'Privacy Policy URL',
      'Terms and Conditions URL',
    ];
    textBoxLabels.forEach(label => {
      expect(screen.getByRole('textbox', {name: label})).toBeInTheDocument();
    });
    expect(screen.getByRole('button', {name: 'Create Client'})).toBeInTheDocument();
  });

  it('sends the correct data to the API', async () => {
    render(<InstanceLevelOAuth />);
    await userEvent.click(screen.getByText('New Instance Level OAuth Client'));
    renderGlobalModal();
    await userEvent.type(screen.getByRole('textbox', {name: 'Client Name'}), 'Santry');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Allowed Origins'}),
      'https://santry.com/origin https://santry.com/origin2 https://santry.com/origin3'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Redirect URIs'}),
      'https://santry.com/redirect1 https://santry.com/redirect2'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Homepage URL'}),
      'https://santry.com/home'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Privacy Policy URL'}),
      'https://santry.com/privacy'
    );
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Terms and Conditions URL'}),
      'https://santry.com/terms'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create Client'}));
    expect(mockPostRequest).toHaveBeenCalledTimes(1);
    const submittedPostRequestBody = mockPostRequest.mock.calls[0][1].data;
    expect(submittedPostRequestBody).toEqual({
      name: 'Santry',
      allowedOrigins:
        'https://santry.com/origin https://santry.com/origin2 https://santry.com/origin3',
      redirectUris: 'https://santry.com/redirect1 https://santry.com/redirect2',
      homepageUrl: 'https://santry.com/home',
      privacyUrl: 'https://santry.com/privacy',
      termsUrl: 'https://santry.com/terms',
    });
  });
});
