import styled from '@emotion/styled';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import SentryAppRuleModal from 'sentry/views/alerts/rules/issue/sentryAppRuleModal';
import type {
  FieldFromSchema,
  SchemaFormConfig,
} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

describe('SentryAppRuleModal', function () {
  const modalElements = {
    Header: p => p.children,
    Body: p => p.children,
    Footer: p => p.children,
  };
  let sentryApp;
  let sentryAppInstallation;

  beforeEach(function () {
    sentryApp = SentryAppFixture();
    sentryAppInstallation = SentryAppInstallationFixture();
  });

  const _submit = async () => {
    await userEvent.click(screen.getByText('Save Changes'));
    return screen.queryAllByText('Field is required');
  };

  const submitSuccess = async () => {
    const errors = await _submit();
    expect(errors).toHaveLength(0);
  };

  const defaultConfig: SchemaFormConfig = {
    uri: '/integration/test/',
    description: '',
    required_fields: [
      {
        type: 'text',
        label: 'Alert Title',
        name: 'title',
      },
      {
        type: 'textarea',
        label: 'Alert Description',
        name: 'description',
      },
      {
        type: 'select',
        label: 'Team Channel',
        name: 'channel',
        choices: [
          ['valor', 'valor'],
          ['mystic', 'mystic'],
          ['instinct', 'instinct'],
        ],
      },
    ],
    optional_fields: [
      {
        type: 'text',
        label: 'Extra Details',
        name: 'extra',
      },
      {
        type: 'select',
        label: 'Assignee',
        name: 'assignee',
        uri: '/link/assignee/',
      },
      {
        type: 'select',
        label: 'Workspace',
        name: 'workspace',
        uri: '/link/workspace/',
      },
    ],
  };

  const resetValues = {
    settings: [
      {
        name: 'extra',
        value: 'saved details from last edit',
      },
      {
        name: 'assignee',
        value: 'edna-mode',
        label: 'Edna Mode',
      },
    ],
  };

  const createWrapper = (props = {}) => {
    const styledWrapper = styled(c => c.children);
    return render(
      <SentryAppRuleModal
        {...modalElements}
        sentryAppInstallationUuid={sentryAppInstallation.uuid}
        appName={sentryApp.name}
        config={defaultConfig}
        onSubmitSuccess={() => {}}
        resetValues={resetValues}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(() => {})}
        Body={styledWrapper()}
        Footer={styledWrapper()}
        {...props}
      />
    );
  };

  describe('Create UI Alert Rule', function () {
    it('should render the Alert Rule modal with the config fields', function () {
      createWrapper();
      const {required_fields, optional_fields} = defaultConfig;
      const allFields = [...required_fields!, ...optional_fields!];

      allFields.forEach((field: FieldFromSchema) => {
        if (typeof field.label === 'string') {
          expect(screen.getByText(field.label)).toBeInTheDocument();
        }
      });
    });

    it('submit button shall be disabled if form is incomplete', async function () {
      createWrapper();
      expect(screen.getByRole('button', {name: 'Save Changes'})).toBeDisabled();
      await userEvent.hover(screen.getByRole('button', {name: 'Save Changes'}));
      expect(
        await screen.findByText('Required fields must be filled out')
      ).toBeInTheDocument();
    });

    it('should submit when "Save Changes" is clicked with valid data', async function () {
      createWrapper();

      const titleInput = screen.getByTestId('title');
      await userEvent.type(titleInput, 'some title');

      const descriptionInput = screen.getByTestId('description');
      await userEvent.type(descriptionInput, 'some description');

      const channelInput = screen.getAllByText('Type to search')[0];
      await userEvent.type(channelInput, '{keyDown}');
      await userEvent.click(screen.getByText('valor'));

      // Ensure text fields are persisted on edit
      const savedExtraDetailsInput = screen.getByDisplayValue(
        resetValues.settings[0].value
      );
      expect(savedExtraDetailsInput).toBeInTheDocument();
      // Ensure select fields are persisted with labels on edit
      const savedAssigneeInput = screen.getByText(resetValues.settings[1].label!);
      expect(savedAssigneeInput).toBeInTheDocument();

      // Ensure async select fields filter correctly
      const workspaceChoices = [
        ['WS0', 'Primary Workspace'],
        ['WS1', 'Secondary Workspace'],
      ];
      const workspaceResponse = MockApiClient.addMockResponse({
        url: `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`,
        body: {choices: workspaceChoices},
      });
      const workspaceInput = screen.getByText('Type to search');
      // Search by value
      await userEvent.type(workspaceInput, workspaceChoices[1][0]);
      await waitFor(() => expect(workspaceResponse).toHaveBeenCalled());
      // Select by label
      await userEvent.click(screen.getByText(workspaceChoices[1][1]));

      await submitSuccess();
    });
    it('should load all default fields correctly', function () {
      const schema: SchemaFormConfig = {
        uri: '/api/sentry/issue-link/create/',
        required_fields: [
          {
            type: 'text',
            label: 'Task Name',
            name: 'title',
            default: 'issue.title',
          },
        ],
        optional_fields: [
          {
            type: 'select',
            label: 'What is the estimated complexity?',
            name: 'complexity',
            choices: [
              ['low', 'low'],
              ['high', 'high'],
              ['medium', 'medium'],
            ],
          },
        ],
      };
      const defaultValues = {
        settings: [
          {
            name: 'title',
            value: 'poiggers',
          },
          {
            name: 'complexity',
            value: 'low',
          },
        ],
      };

      createWrapper({config: schema, resetValues: defaultValues});

      expect(screen.getByText('low')).toBeInTheDocument();
      expect(screen.queryByText('poiggers')).not.toBeInTheDocument();
    });
    it('should not make external calls until depends on fields are filled in', async function () {
      const mockApi = MockApiClient.addMockResponse({
        url: `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`,
        body: {
          choices: [
            ['low', 'Low'],
            ['medium', 'Medium'],
            ['high', 'High'],
          ],
        },
      });

      const schema: SchemaFormConfig = {
        uri: '/api/sentry/issue-link/create/',
        required_fields: [
          {
            type: 'text',
            label: 'Task Name',
            name: 'title',
          },
        ],
        optional_fields: [
          {
            type: 'select',
            label: 'What is the estimated complexity?',
            name: 'complexity',
            depends_on: ['title'],
            skip_load_on_open: true,
            uri: '/api/sentry/options/complexity-options/',
            choices: [],
          },
        ],
      };
      const defaultValues = {
        settings: [
          {
            name: 'extra',
            value: 'saved details from last edit',
          },
        ],
      };

      createWrapper({config: schema, resetValues: defaultValues});
      await waitFor(() => expect(mockApi).not.toHaveBeenCalled());

      await userEvent.type(screen.getByText('Task Name'), 'sooo coooool');

      // Now that the title is filled we should get the options
      await waitFor(() => expect(mockApi).toHaveBeenCalled());
    });

    it('should load complexity options from backend when column has a default value', async function () {
      const mockApi = MockApiClient.addMockResponse({
        url: `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`,
        body: {
          choices: [
            ['low', 'Low'],
            ['medium', 'Medium'],
            ['high', 'High'],
          ],
        },
      });

      const schema: SchemaFormConfig = {
        uri: '/api/sentry/issue-link/create/',
        required_fields: [
          {
            type: 'text',
            label: 'Task Name',
            name: 'title',
            default: 'issue.title',
          },
          {
            type: 'select',
            label: "What's the status of this task?",
            name: 'column',
            uri: '/api/sentry/options/status/',
            defaultValue: 'ongoing',
            choices: [
              ['ongoing', 'ongoing'],
              ['completed', 'completed'],
              ['pending', 'pending'],
              ['cancelled', 'cancelled'],
            ],
          },
        ],
        optional_fields: [
          {
            type: 'select',
            label: 'What is the estimated complexity?',
            name: 'complexity',
            depends_on: ['column'],
            skip_load_on_open: true,
            uri: '/api/sentry/options/complexity-options/',
            choices: [],
          },
        ],
      };

      createWrapper({config: schema});

      // Wait for component to mount and state to update
      await waitFor(() => expect(mockApi).toHaveBeenCalled());

      // Check if complexity options are loaded
      const complexityInput = screen.getByLabelText('What is the estimated complexity?', {
        selector: 'input#complexity',
      });

      expect(screen.queryByText('Low')).not.toBeInTheDocument();
      await userEvent.click(complexityInput);
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should populate skip_load_on fields with the default value', async function () {
      const mockApi = MockApiClient.addMockResponse({
        url: `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`,
        body: {
          choices: [
            ['low', 'Low'],
            ['medium', 'Medium'],
            ['high', 'High'],
          ],
        },
      });

      const schema: SchemaFormConfig = {
        uri: '/api/sentry/issue-link/create/',
        required_fields: [
          {
            type: 'text',
            label: 'Task Name',
            name: 'title',
            defaultValue: 'pog',
            default: 'issue.title',
          },
        ],
        optional_fields: [
          {
            type: 'select',
            label: 'What is the estimated complexity?',
            name: 'complexity',
            depends_on: ['title'],
            skip_load_on_open: true,
            uri: '/api/sentry/options/complexity-options/',
            choices: [],
          },
        ],
      };
      const defaultValues = {
        settings: [
          {
            name: 'extra',
            value: 'saved details from last edit',
          },
          {
            name: 'assignee',
            value: 'edna-mode',
            label: 'Edna Mode',
          },
          {
            name: 'complexity',
            value: 'low',
          },
        ],
      };

      createWrapper({config: schema, resetValues: defaultValues});

      // Wait for component to mount and state to update
      await waitFor(() => expect(mockApi).toHaveBeenCalled());
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.queryByText('Medium')).not.toBeInTheDocument();
      expect(screen.queryByText('High')).not.toBeInTheDocument();
    });
  });
});
