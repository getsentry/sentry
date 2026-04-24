import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  SentryAppExternalForm,
  type SchemaFormConfig,
} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

describe('SentryAppExternalForm', () => {
  const sentryAppInstallation = SentryAppInstallationFixture();
  const externalRequestsUrl = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`;
  const externalIssueActionsUrl = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-issue-actions/`;

  const baseConfig: SchemaFormConfig = {
    uri: '/integration/test/',
    required_fields: [
      {type: 'text', label: 'Title', name: 'title'},
      {
        type: 'select',
        label: 'Channel',
        name: 'channel',
        choices: [
          ['a', 'Alpha'],
          ['b', 'Beta'],
        ],
      },
    ],
    optional_fields: [{type: 'text', label: 'Notes', name: 'notes'}],
  };

  const baseProps = {
    action: 'create' as const,
    appName: 'Test App',
    element: 'issue-link' as const,
    sentryAppInstallationUuid: sentryAppInstallation.uuid,
    config: baseConfig,
    onSubmitSuccess: jest.fn(),
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders nothing when sentryAppInstallationUuid is empty', () => {
    const {container} = render(
      <SentryAppExternalForm {...baseProps} sentryAppInstallationUuid="" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onSubmitSuccess after a successful issue-link POST', async () => {
    MockApiClient.addMockResponse({
      url: externalIssueActionsUrl,
      method: 'POST',
      body: {webUrl: 'https://example.com/issue/1'},
    });

    const onSubmitSuccess = jest.fn();
    render(<SentryAppExternalForm {...baseProps} onSubmitSuccess={onSubmitSuccess} />);

    await userEvent.type(screen.getByTestId('title'), 'Hello');
    await userEvent.type(screen.getByText('Type to search'), '{keyDown}');
    await userEvent.click(screen.getByText('Alpha'));

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(onSubmitSuccess).toHaveBeenCalled());
  });

  it('packages data into a settings array for alert-rule-action submissions', async () => {
    const onSubmitSuccess = jest.fn();
    render(
      <SentryAppExternalForm
        {...baseProps}
        element="alert-rule-action"
        onSubmitSuccess={onSubmitSuccess}
      />
    );

    await userEvent.type(screen.getByTestId('title'), 'My Alert');
    await userEvent.type(screen.getByText('Type to search'), '{keyDown}');
    await userEvent.click(screen.getByText('Beta'));

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() => expect(onSubmitSuccess).toHaveBeenCalled());

    // alert-rule-action bypasses Form's POST and calls onSubmitSuccess with
    // a payload that nests the field values under `settings`.
    const payload = onSubmitSuccess.mock.calls[0][0];
    expect(payload.hasSchemaFormConfig).toBe(true);
    expect(payload.sentryAppInstallationUuid).toBe(sentryAppInstallation.uuid);
    expect(payload.settings).toEqual(
      expect.arrayContaining([
        {name: 'title', value: 'My Alert'},
        {name: 'channel', value: 'b'},
      ])
    );
  });

  it('does not submit an alert-rule-action if validation fails', () => {
    const onSubmitSuccess = jest.fn();
    render(
      <SentryAppExternalForm
        {...baseProps}
        element="alert-rule-action"
        onSubmitSuccess={onSubmitSuccess}
      />
    );

    // Form is invalid — required fields are empty. Submit button should be disabled.
    expect(screen.getByRole('button', {name: 'Save Changes'})).toBeDisabled();
    expect(onSubmitSuccess).not.toHaveBeenCalled();
  });

  it('loads options for a depends_on field only after the parent is filled', async () => {
    const external = MockApiClient.addMockResponse({
      url: externalRequestsUrl,
      body: {
        choices: [
          ['sm', 'Small'],
          ['lg', 'Large'],
        ],
      },
    });

    render(
      <SentryAppExternalForm
        {...baseProps}
        config={{
          uri: '/integration/test/',
          required_fields: [{type: 'text', label: 'Name', name: 'name'}],
          optional_fields: [
            {
              type: 'select',
              label: 'Size',
              name: 'size',
              depends_on: ['name'],
              skip_load_on_open: true,
              uri: '/options/size/',
              choices: [],
            },
          ],
        }}
      />
    );

    // On mount the gate keeps `size` from loading because `name` is empty.
    expect(external).not.toHaveBeenCalled();

    await userEvent.type(screen.getByText('Name'), 'widget');
    expect(screen.getByDisplayValue('widget')).toBeInTheDocument();

    // Each keystroke fires onFieldChange → handleFieldChange → one load.
    await waitFor(() => expect(external).toHaveBeenCalledTimes('widget'.length));
  });

  it('preserves a saved select label via resetValues for async selects', () => {
    render(
      <SentryAppExternalForm
        {...baseProps}
        config={{
          uri: '/integration/test/',
          required_fields: [
            {type: 'select', label: 'Assignee', name: 'assignee', uri: '/assignees/'},
          ],
        }}
        resetValues={{
          settings: [{name: 'assignee', value: 'edna-mode', label: 'Edna Mode'}],
        }}
      />
    );

    expect(screen.getByText('Edna Mode')).toBeInTheDocument();
  });

  it('resets form state when the action prop changes', async () => {
    MockApiClient.addMockResponse({
      url: externalIssueActionsUrl,
      method: 'POST',
      body: {},
    });

    const {rerender} = render(<SentryAppExternalForm {...baseProps} action="create" />);

    await userEvent.type(screen.getByTestId('title'), 'draft');
    expect(screen.getByDisplayValue('draft')).toBeInTheDocument();

    rerender(<SentryAppExternalForm {...baseProps} action="link" />);

    // The effect keyed on `action` resets the model; the previously typed value is gone.
    await waitFor(() => {
      expect(screen.queryByDisplayValue('draft')).not.toBeInTheDocument();
    });
  });
});
