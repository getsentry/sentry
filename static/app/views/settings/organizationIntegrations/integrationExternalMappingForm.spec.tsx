import React from 'react';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';

import IntegrationExternalMappingForm from './integrationExternalMappingForm';

describe('IntegrationExternalMappingForm', () => {
  const membersEndpoint = '/organizations/org-slug/members/';
  const teamsEndpoint = '/organizations/org-slug/teams/';
  const baseProps = {
    integration: GitHubIntegrationFixture(),
    getBaseFormEndpoint: jest.fn(_mapping => membersEndpoint),
  } satisfies Partial<React.ComponentProps<typeof IntegrationExternalMappingForm>>;

  const closeModal = jest.fn();
  const modalProps = {
    Body: ModalBody,
    Header: makeClosableHeader(jest.fn()),
    Footer: ModalFooter,
    CloseButton: makeCloseButton(jest.fn()),
    closeModal,
  };

  const MOCK_USER_MAPPING = {
    id: '1',
    userId: '1',
    externalName: '@gwen',
    sentryName: 'gwen@mcu.org',
  };
  const MOCK_TEAM_MAPPING = {
    id: '1',
    teamId: '1',
    externalName: '@getsentry/animals',
    sentryName: '#zoo',
  };

  // Member data with email === name so labels are just 'option1', 'option2', etc.
  const MOCK_MEMBERS = [
    {name: 'option1', email: 'option1', user: {id: '1'}},
    {name: 'option2', email: 'option2', user: {id: '2'}},
    {name: 'option3', email: 'option3', user: {id: '3'}},
  ];
  const MOCK_TEAMS = [
    {id: '1', slug: 'option1'},
    {id: '2', slug: 'option2'},
    {id: '3', slug: 'option3'},
  ];

  let postResponse: jest.Mock;
  let putResponse: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: membersEndpoint,
      method: 'GET',
      body: MOCK_MEMBERS,
    });
    MockApiClient.addMockResponse({
      url: teamsEndpoint,
      method: 'GET',
      body: MOCK_TEAMS,
    });
    postResponse = MockApiClient.addMockResponse({
      url: membersEndpoint,
      method: 'POST',
      body: {},
    });
    putResponse = MockApiClient.addMockResponse({
      url: `${membersEndpoint}1/`,
      method: 'PUT',
      body: {},
    });
  });

  // No mapping provided (e.g. Create a new mapping)
  it('renders with no mapping provided as a form', async () => {
    render(<IntegrationExternalMappingForm type="user" {...modalProps} {...baseProps} />);
    expect(await screen.findByPlaceholderText('@username')).toBeInTheDocument();
    expect(screen.getByText('Select Sentry User')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeInTheDocument();
  });

  it('renders with no mapping as an inline field', async () => {
    render(<IntegrationExternalMappingForm isInline type="user" {...baseProps} />);
    expect(await screen.findByText('Select Sentry User')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('@username')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save Changes'})).not.toBeInTheDocument();
  });

  // Full mapping provided (e.g. Update an existing mapping)
  it('renders with a full mapping provided as a form', async () => {
    render(
      <IntegrationExternalMappingForm
        type="user"
        mapping={MOCK_USER_MAPPING}
        {...modalProps}
        {...baseProps}
      />
    );
    expect(
      await screen.findByDisplayValue(MOCK_USER_MAPPING.externalName)
    ).toBeInTheDocument();
    expect(
      await screen.findByText(`option${MOCK_USER_MAPPING.userId}`)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeInTheDocument();
  });

  it('renders with a full mapping provided as an inline field', async () => {
    render(
      <IntegrationExternalMappingForm
        isInline
        type="user"
        mapping={MOCK_USER_MAPPING}
        {...baseProps}
      />
    );
    expect(
      await screen.findByText(`option${MOCK_USER_MAPPING.userId}`)
    ).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue(MOCK_USER_MAPPING.externalName)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save Changes'})).not.toBeInTheDocument();
  });

  // Suggested mapping provided (e.g. Create new mapping from suggested external name)
  it('renders with a suggested mapping provided as a form', async () => {
    render(
      <IntegrationExternalMappingForm
        type="team"
        mapping={{externalName: MOCK_TEAM_MAPPING.externalName}}
        {...modalProps}
        {...baseProps}
      />
    );
    expect(
      await screen.findByDisplayValue(MOCK_TEAM_MAPPING.externalName)
    ).toBeInTheDocument();
    expect(screen.getByText('Select Sentry Team')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeInTheDocument();
  });

  it('renders with a suggested mapping provided as an inline field', async () => {
    render(
      <IntegrationExternalMappingForm
        isInline
        type="team"
        mapping={{externalName: MOCK_TEAM_MAPPING.externalName}}
        {...baseProps}
      />
    );
    expect(await screen.findByText('Select Sentry Team')).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue(MOCK_TEAM_MAPPING.externalName)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save Changes'})).not.toBeInTheDocument();
  });

  it('submits the form with correct data in modal mode', async () => {
    render(
      <IntegrationExternalMappingForm
        type="user"
        mapping={{externalName: MOCK_USER_MAPPING.externalName}}
        {...modalProps}
        {...baseProps}
      />
    );

    expect(baseProps.getBaseFormEndpoint).not.toHaveBeenCalled();
    expect(postResponse).not.toHaveBeenCalled();

    // Open select and wait for options to load
    await userEvent.click(screen.getByRole('textbox', {name: 'Sentry User'}));
    await screen.findByRole('menuitemradio', {name: 'option1'});
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'option2'}));

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => {
      expect(baseProps.getBaseFormEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          externalName: MOCK_USER_MAPPING.externalName,
          integrationId: baseProps.integration.id,
          provider: baseProps.integration.provider.key,
          userId: '2',
        })
      );
    });

    expect(postResponse).toHaveBeenCalled();
    expect(putResponse).not.toHaveBeenCalled();
  });

  it('saves on change when used as an inline field', async () => {
    render(
      <IntegrationExternalMappingForm
        isInline
        type="team"
        mapping={MOCK_TEAM_MAPPING}
        {...baseProps}
      />
    );

    // Wait for options to load
    expect(await screen.findByText('option1')).toBeInTheDocument();
    expect(baseProps.getBaseFormEndpoint).not.toHaveBeenCalled();
    expect(putResponse).not.toHaveBeenCalled();

    // Select option3 from the select
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'option3'}));

    await waitFor(() => {
      expect(baseProps.getBaseFormEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          ...MOCK_TEAM_MAPPING,
          integrationId: baseProps.integration.id,
          provider: baseProps.integration.provider.key,
          teamId: '3',
        })
      );
    });
    expect(putResponse).toHaveBeenCalled();
    expect(postResponse).not.toHaveBeenCalled();
  });

  it('triggers mutation again when re-selecting the original value after a save', async () => {
    function Wrapper() {
      const [teamId, setTeamId] = React.useState(MOCK_TEAM_MAPPING.teamId);
      const mapping = {...MOCK_TEAM_MAPPING, teamId};
      return (
        <IntegrationExternalMappingForm
          isInline
          type="team"
          mapping={mapping}
          {...baseProps}
          onSubmitSuccess={() => {
            // Simulate what the parent does: refetch data, which updates the mapping
            const lastData = baseProps.getBaseFormEndpoint.mock.lastCall![0];
            setTeamId(lastData?.teamId ?? teamId);
          }}
        />
      );
    }

    render(<Wrapper />);

    // Wait for options to load
    expect(await screen.findByText('option1')).toBeInTheDocument();

    // Select option3 (different from the initial teamId '1' = option1)
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'option3'}));

    await waitFor(() => {
      expect(putResponse).toHaveBeenCalledTimes(1);
    });

    // Now re-select option1 (the original value) — this should trigger another mutation
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'option1'}));

    await waitFor(() => {
      expect(putResponse).toHaveBeenCalledTimes(2);
    });
  });

  it('fetches options with search query when typing', async () => {
    const searchResponse = MockApiClient.addMockResponse({
      url: membersEndpoint,
      method: 'GET',
      body: [{name: 'searched-option', email: 'searched-option', user: {id: '4'}}],
      match: [MockApiClient.matchQuery({query: 'searched'})],
    });

    render(
      <IntegrationExternalMappingForm
        type="user"
        mapping={{externalName: MOCK_USER_MAPPING.externalName}}
        {...modalProps}
        {...baseProps}
      />
    );

    // Open select and wait for initial options
    await userEvent.click(screen.getByRole('textbox', {name: 'Sentry User'}));
    await screen.findByRole('menuitemradio', {name: 'option1'});

    // Type a search query
    await userEvent.type(screen.getByRole('textbox', {name: 'Sentry User'}), 'searched');

    await waitFor(() => {
      expect(searchResponse).toHaveBeenCalled();
    });

    expect(
      await screen.findByRole('menuitemradio', {name: 'searched-option'})
    ).toBeInTheDocument();
  });

  it('allows defaultOptions to be provided', async () => {
    const defaultOptions = MOCK_MEMBERS.map(m => ({value: m.user.id, label: m.name}));
    render(
      <IntegrationExternalMappingForm
        type="user"
        mapping={MOCK_USER_MAPPING}
        defaultOptions={defaultOptions}
        {...modalProps}
        {...baseProps}
      />
    );

    // The selected mapping option should appear
    expect(
      await screen.findByText(`option${MOCK_USER_MAPPING.userId}`)
    ).toBeInTheDocument();

    // Open the select and verify options are available
    await userEvent.click(screen.getByRole('textbox', {name: 'Sentry User'}));
    expect(screen.getByRole('menuitemradio', {name: 'option1'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'option2'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'option3'})).toBeInTheDocument();
  });

  it('shows mapped value immediately without waiting for fetch when defaultOptions are provided', () => {
    const defaultOptions = MOCK_MEMBERS.map(m => ({value: m.user.id, label: m.name}));
    render(
      <IntegrationExternalMappingForm
        isInline
        type="user"
        mapping={MOCK_USER_MAPPING}
        defaultOptions={defaultOptions}
        {...baseProps}
      />
    );

    // The mapped value should be visible immediately (synchronously),
    // not after waiting for the async fetch to resolve
    expect(screen.getByText(`option${MOCK_USER_MAPPING.userId}`)).toBeInTheDocument();
  });
});
