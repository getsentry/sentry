import type {ComponentProps} from 'react';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {
  SentryAppExternalForm,
  type FieldFromSchema,
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

  const baseProps: ComponentProps<typeof SentryAppExternalForm> = {
    action: 'create',
    appName: 'Test App',
    element: 'issue-link',
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

    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'Hello');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Channel'}), 'Alpha');

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

    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'My Alert');
    await selectEvent.select(screen.getByRole('textbox', {name: 'Channel'}), 'Beta');

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    await waitFor(() =>
      expect(onSubmitSuccess).toHaveBeenCalledWith({
        hasSchemaFormConfig: true,
        sentryAppInstallationUuid: sentryAppInstallation.uuid,
        settings: expect.arrayContaining([
          {name: 'title', value: 'My Alert'},
          {name: 'channel', value: 'b'},
        ]),
      })
    );
  });

  it('does not submit an alert-rule-action when required fields are empty', async () => {
    const onSubmitSuccess = jest.fn();
    render(
      <SentryAppExternalForm
        {...baseProps}
        element="alert-rule-action"
        onSubmitSuccess={onSubmitSuccess}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    expect(onSubmitSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: 'Title'})).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByRole('textbox', {name: 'Channel'})).toHaveAttribute(
      'aria-invalid',
      'true'
    );
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

    expect(external).not.toHaveBeenCalled();

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'widget');

    await waitFor(() => expect(external).toHaveBeenCalled());
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

    await userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'draft');
    expect(screen.getByRole('textbox', {name: 'Title'})).toHaveValue('draft');

    rerender(<SentryAppExternalForm {...baseProps} action="link" />);

    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Title'})).toHaveValue('');
    });
  });

  it('does not reset dependent fields when semantic default props are unchanged', async () => {
    const config: SchemaFormConfig = {
      uri: '/integration/test/',
      required_fields: [
        {type: 'text', label: 'Title', name: 'title', default: 'issue.title'},
        {type: 'text', label: 'Notes', name: 'notes'},
      ],
      optional_fields: [
        {
          type: 'select',
          label: 'Size',
          name: 'size',
          depends_on: ['title'],
          uri: '/options/size/',
          choices: [],
        },
      ],
    };

    const getFieldDefault = (field: FieldFromSchema) =>
      field.default === 'issue.title' ? 'Default title' : '';

    const external = MockApiClient.addMockResponse({
      url: externalRequestsUrl,
      body: {
        choices: [
          ['sm', 'Small'],
          ['lg', 'Large'],
        ],
        defaultValue: 'sm',
      },
    });

    const {rerender} = render(
      <SentryAppExternalForm
        {...baseProps}
        config={config}
        extraRequestBody={{projectId: '123'}}
        getFieldDefault={getFieldDefault}
      />
    );

    await waitFor(() => expect(external).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Small')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), 'persist me');
    expect(screen.getByRole('textbox', {name: 'Notes'})).toHaveValue('persist me');

    rerender(
      <SentryAppExternalForm
        {...baseProps}
        config={config}
        extraRequestBody={{projectId: '123'}}
        getFieldDefault={field =>
          field.default === 'issue.title' ? 'Default title' : ''
        }
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Notes'})).toHaveValue('persist me');
    });
    expect(external).toHaveBeenCalledTimes(1);
  });
});
