import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueAlertOptions from 'sentry/views/projectInstall/issueAlertOptions';

describe('IssueAlertOptions', function () {
  const {organization} = initializeOrg();
  const URL = `/projects/${organization.slug}/rule-conditions/`;
  const props = {
    onChange: jest.fn(),
  };
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/rule-conditions/`,
      body: TestStubs.MOCK_RESP_VERBOSE,
    });
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should render only the `Default Rule` and `Create Later` option on empty response:[]', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: [],
    });

    render(<IssueAlertOptions {...props} />, {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('should render only the `Default Rule` and `Create Later` option on empty response:{}', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: {},
    });

    render(<IssueAlertOptions {...props} />, {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('should render only the `Default Rule` and `Create Later` option on responses with different allowable intervals', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: TestStubs.MOCK_RESP_INCONSISTENT_INTERVALS,
    });

    render(<IssueAlertOptions {...props} />, {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('should render all(three) options on responses with different placeholder values', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: TestStubs.MOCK_RESP_INCONSISTENT_PLACEHOLDERS,
    });
    render(<IssueAlertOptions {...props} />, {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('should ignore conditions that are not `sentry.rules.conditions.event_frequency.EventFrequencyCondition` and `sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition`', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: TestStubs.MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID,
    });

    render(<IssueAlertOptions {...props} />, {organization});
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await selectEvent.select(screen.getByText('Select...'), 'users affected by');
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRules: false,
        shouldCreateCustomRule: true,
      })
    );
  });

  it('should render all(three) options on a valid response', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: TestStubs.MOCK_RESP_VERBOSE,
    });

    render(<IssueAlertOptions {...props} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('should pre-populate fields from server response', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: TestStubs.MOCK_RESP_VERBOSE,
    });

    render(<IssueAlertOptions {...props} />);
    await selectEvent.select(screen.getByText('occurrences of'), 'users affected by');
    await selectEvent.select(screen.getByText('one minute'), '30 days');
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultRules: false,
        shouldCreateCustomRule: true,
      })
    );
  });

  it('should not pre-fill threshold value after a valid server response', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: TestStubs.MOCK_RESP_VERBOSE,
    });

    render(<IssueAlertOptions {...props} />);
    expect(screen.getByTestId('range-input')).toHaveValue(null);
  });

  it('should provide fallthroughType with issue action for issue-alert-fallback-targeting', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: TestStubs.MOCK_RESP_VERBOSE,
    });
    const org = {...organization, features: ['issue-alert-fallback-targeting']};

    render(<IssueAlertOptions {...props} organization={org} />);
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
});
