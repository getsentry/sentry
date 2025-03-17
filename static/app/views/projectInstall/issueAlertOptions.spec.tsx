import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {
  MOCK_RESP_INCONSISTENT_INTERVALS,
  MOCK_RESP_INCONSISTENT_PLACEHOLDERS,
  MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID,
  MOCK_RESP_VERBOSE,
} from 'sentry-fixture/ruleConditions';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import IssueAlertOptions from 'sentry/views/projectInstall/issueAlertOptions';

describe('IssueAlertOptions', function () {
  const organization = OrganizationFixture();
  const URL = `/projects/${organization.slug}/rule-conditions/`;

  const notificationProps: IssueAlertNotificationProps = {
    actions: [],
    channel: 'channel',
    integration: OrganizationIntegrationsFixture(),
    provider: 'slack',
    providersToIntegrations: {},
    querySuccess: true,
    shouldRenderSetupButton: false,
    setActions: jest.fn(),
    setChannel: jest.fn(),
    setIntegration: jest.fn(),
    setProvider: jest.fn(),
  };

  const props = {
    onChange: jest.fn(),
    organization,
    notificationProps,
  };
  const getComponent = () => <IssueAlertOptions {...props} {...notificationProps} />;

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/rule-conditions/`,
      body: MOCK_RESP_VERBOSE,
    });
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should render only the `Default Rule` and `Create Later` option on empty response:[]', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: [],
    });

    render(getComponent(), {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('should render only the `Default Rule` and `Create Later` option on empty response:{}', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: {},
    });

    render(getComponent(), {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('should render only the `Default Rule` and `Create Later` option on responses with different allowable intervals', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_INCONSISTENT_INTERVALS,
    });

    render(getComponent(), {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('should render all(three) options on responses with different placeholder values', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_INCONSISTENT_PLACEHOLDERS,
    });
    render(getComponent(), {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('should ignore conditions that are not `sentry.rules.conditions.event_frequency.EventFrequencyCondition` and `sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition`', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID,
    });

    render(getComponent(), {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await selectEvent.select(screen.getByText('Select...'), 'users affected by');
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRules: false,
        shouldCreateCustomRule: true,
      })
    );
  });

  it('should render all(three) options on a valid response', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    render(getComponent());
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('should pre-populate fields from server response', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    render(getComponent());
    await selectEvent.select(screen.getByText('occurrences of'), 'users affected by');
    await selectEvent.select(screen.getByText('one minute'), '30 days');
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRules: false,
        shouldCreateCustomRule: true,
      })
    );
  });

  it('should pre-fill threshold value after a valid server response', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    render(getComponent());
    expect(screen.getByTestId('range-input')).toHaveValue(10);
  });

  it('should provide fallthroughType with issue action', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    render(getComponent());
    await userEvent.click(screen.getByLabelText(/When there are more than/i));
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          {
            id: 'sentry.mail.actions.NotifyEmailAction',
            targetType: 'IssueOwners',
            fallthroughType: 'ActiveMembers',
          },
        ],
      })
    );
  });

  it('should render alert configuration if `Default` or `Custom` alerts are selected', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    render(getComponent());
    await screen.findByRole('checkbox', {name: 'Notify via email'});
    await screen.findByRole('checkbox', {
      name: 'Notify via integration (Slack, Discord, MS Teams, etc.)',
    });
    await selectEvent.select(screen.getByText('occurrences of'), 'users affected by');
    await screen.findByRole('checkbox', {name: 'Notify via email'});
    await screen.findByRole('checkbox', {
      name: 'Notify via integration (Slack, Discord, MS Teams, etc.)',
    });
  });

  it('should not render notification configuration if `Create Alerts Later` is selected', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    render(getComponent());
    await userEvent.click(screen.getByLabelText("I'll create my own alerts later"));
    expect(
      screen.queryByRole('checkbox', {name: 'Notify via email'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {
        name: 'Notify via integration (Slack, Discord, MS Teams, etc.)',
      })
    ).not.toBeInTheDocument();
  });
});
