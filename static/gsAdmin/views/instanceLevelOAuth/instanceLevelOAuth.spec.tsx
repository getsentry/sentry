import {render, screen} from 'sentry-test/reactTestingLibrary';

import InstanceLevelOAuth from 'admin/views/instanceLevelOAuth/instanceLevelOAuth';

describe('instance level OAuth list', () => {
  const mockClientRows = [
    {
      name: 'CodeCov',
      clientID:
        'e535bb78-706c-4c3d-816c-95b4d9bc8a04eda5aa18-9ea2-44b2-af38-664512b911b9',
      date_added: '2023-06-07 22:25:58.014042+00',
    },
    {
      name: 'Syntax',
      clientID:
        'c2e51ecb-1018-4838-a2f1-45674810343f7325a139-e1a0-45c0-86c6-7425b17ac436',
      date_added: '2023-06-07 22:25:58.014042+00',
    },
    {
      name: 'Earth',
      clientID:
        '3f80974a-d59c-474d-b75f-37a011da09980ee6b8e4-e934-46d4-be0d-b5effcdca1bd',
      date_added: '2023-06-07 22:25:58.014042+00',
    },
  ];

  const mockGetListCall = MockApiClient.addMockResponse({
    url: '/_admin/instance-level-oauth/',
    method: 'GET',
    body: mockClientRows,
  });

  it('renders a list of instance level OAuth clients', async () => {
    render(<InstanceLevelOAuth />);
    expect(screen.getByText('Instance Level OAuth Clients')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Client ID')).toBeInTheDocument();
    expect(screen.getByText('CodeCov')).toBeInTheDocument();
    for (const row of mockClientRows) {
      expect(await screen.findByText(row.clientID)).toBeInTheDocument();
    }
    expect(mockGetListCall).toHaveBeenCalledTimes(1);
  });
});
