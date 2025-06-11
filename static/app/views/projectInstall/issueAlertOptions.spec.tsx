import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {IssueAlertNotificationProps} from 'sentry/views/projectInstall/issueAlertNotificationOptions';
import type {IssueAlertOptionsProps} from 'sentry/views/projectInstall/issueAlertOptions';
import IssueAlertOptions, {
  RuleAction,
} from 'sentry/views/projectInstall/issueAlertOptions';

describe('IssueAlertOptions', function () {
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

  const mockOnChange = jest.fn();
  const getComponent = (props: Partial<IssueAlertOptionsProps> = {}) => (
    <IssueAlertOptions
      notificationProps={notificationProps}
      onFieldChange={mockOnChange}
      {...props}
    />
  );

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should pre-fill threshold value after a valid server response', () => {
    render(getComponent());
    expect(screen.getByTestId('range-input')).toHaveValue(10);
  });

  it('should provide fallthroughType with issue action', async () => {
    render(getComponent());
    await userEvent.click(screen.getByLabelText(/When there are more than/i));
    expect(mockOnChange).toHaveBeenCalledWith('alertSetting', 1);
  });

  it('should render alert configuration if `Default` or `Custom` alerts are selected', async () => {
    render(getComponent());

    // Default will be RuleAction.DEFAULT_ALERT
    expect(screen.getByRole('checkbox', {name: 'Notify via email'})).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Notify via integration (Slack, Discord, MS Teams, etc.)',
      })
    ).toBeInTheDocument();

    // Select RuleAction.CUSTOMIZED_ALERTS
    await userEvent.click(screen.getByLabelText(/When there are more than/i));
    expect(screen.getByRole('checkbox', {name: 'Notify via email'})).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Notify via integration (Slack, Discord, MS Teams, etc.)',
      })
    ).toBeInTheDocument();
  });

  it('should not render notification configuration if `Create Alerts Later` is selected', () => {
    render(getComponent({alertSetting: RuleAction.CREATE_ALERT_LATER}));
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
