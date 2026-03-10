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
  const dataEndpoint = '/test/dataEndpoint/';
  const baseProps = {
    integration: GitHubIntegrationFixture(),
    dataEndpoint,
    getBaseFormEndpoint: jest.fn(_mapping => dataEndpoint),
    sentryNamesMapper: (mappings: any) => mappings,
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
  const DEFAULT_OPTIONS = [
    {id: '1', name: 'option1'},
    {id: '2', name: 'option2'},
    {id: '3', name: 'option3'},
  ];

  let postResponse: jest.Mock;
  let putResponse: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: dataEndpoint,
      method: 'GET',
      body: DEFAULT_OPTIONS,
    });
    postResponse = MockApiClient.addMockResponse({
      url: dataEndpoint,
      method: 'POST',
      body: {},
    });
    putResponse = MockApiClient.addMockResponse({
      url: `${dataEndpoint}1/`,
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

  it('allows defaultOptions to be provided', async () => {
    render(
      <IntegrationExternalMappingForm
        type="user"
        mapping={MOCK_USER_MAPPING}
        defaultOptions={DEFAULT_OPTIONS.map(({id, name}) => ({value: id, label: name}))}
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
});
