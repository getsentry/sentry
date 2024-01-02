import styled from '@emotion/styled';
import {SentryApp} from 'sentry-fixture/sentryApp';
import {SentryAppInstallation as SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

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
    sentryApp = SentryApp();
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

  const submitErrors = async errorCount => {
    const errors = await _submit();
    expect(errors).toHaveLength(errorCount);
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

    it('should raise validation errors when "Save Changes" is clicked with invalid data', async function () {
      createWrapper();
      await submitErrors(3);
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
  });
});
