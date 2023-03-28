import {Fragment, ReactNode, useRef} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {Form, SelectField, TextField} from 'sentry/components/forms';
import {SelectFieldProps} from 'sentry/components/forms/fields/selectField';
import {TextFieldProps} from 'sentry/components/forms/fields/textField';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {
  AvailableNotificationAction,
  NotificationAction,
  NotificationActionService,
} from 'sentry/types/notificationActions';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface NotificationActionFormProps {
  /**
   * The notification action being represented
   */
  action: Partial<NotificationAction>;
  /**
   * The available actions for the action's serviceType (e.g. "slack", "pagerduty")
   */
  availableActions: AvailableNotificationAction[];
  /**
   * The notif action's index in the parent component
   */
  index: number;
  onDelete: (actionId: number) => void;
  onUpdate: (actionId: number, updatedAction: NotificationAction) => void;
  /**
   * Map of pagerduty integration IDs to available actions for those IDs
   */
  pagerdutyIntegrations: Record<number, AvailableNotificationAction[]>;
  project: Project;
  setIsEditing: (isEditing: boolean) => void;
}

function NotificationActionForm({
  action,
  index,
  availableActions,
  onDelete,
  onUpdate,
  setIsEditing,
  pagerdutyIntegrations,
  project,
}: NotificationActionFormProps) {
  const formRef = useRef(new FormModel());
  const serviceType = action.serviceType;
  const api = useApi();
  const organization = useOrganization();

  function getInitialData() {
    return {
      projects: [project?.slug],
      ...action,
    };
  }

  function getFieldFromConfig(field: Field) {
    switch (field.type) {
      case 'select':
        return (
          <StyledSelectField
            key={field.name}
            {...({...field} as SelectFieldProps<any>)}
          />
        );
      case 'text':
        return <StyledTextField key={field.name} {...({...field} as TextFieldProps)} />;
      default:
        return null;
    }
  }

  function renderFormFields(): ReactNode[] {
    if (serviceType === NotificationActionService.SENTRY_NOTIFICATION) {
      return [];
    }

    // TODO(cathy): make it generic (use switch)
    // Slack and Pagerduty
    const options = availableActions
      .map(service => ({
        value: service.action.integrationId ?? '',
        label: service.action.integrationName ?? '',
      }))
      .filter(option => option.value);

    const formFields: ReactNode[] = [];

    if (serviceType === NotificationActionService.SLACK) {
      formFields.push(<div>Send a notification to the</div>);
      formFields.push(
        getFieldFromConfig({
          name: 'integrationId',
          type: 'select',
          required: true,
          options,
        })
      );
      formFields.push(<div>workspace for the channel</div>);
      formFields.push(
        getFieldFromConfig({
          name: 'targetDisplay',
          type: 'text',
          required: true,
          placeholder: t('channel-name'),
        })
      );
      formFields.push(<div>with the channel ID</div>);
      // TODO(cathy): remove targetId when leander's PR merges
      formFields.push(
        getFieldFromConfig({
          name: 'targetIdentifier',
          type: 'text',
          required: true,
          placeholder: t('channel-id'),
        })
      );
    }
    if (serviceType === NotificationActionService.PAGERDUTY) {
      const formIntegrationId = formRef.current.getValue('integrationId');
      const integrationId = formIntegrationId ? formIntegrationId : action.integrationId;
      const targets = pagerdutyIntegrations[integrationId as number];

      const uniqueIntegrations = new Set();
      formFields.push(<div>Send a notification to the</div>);
      formFields.push(
        getFieldFromConfig({
          name: 'integrationId',
          type: 'select',
          required: true,
          options: options.filter(option => {
            if (!uniqueIntegrations.has(option.value)) {
              uniqueIntegrations.add(option.value);
              return true;
            }
            return false;
          }),
        })
      );
      formFields.push(<div>account with the service</div>);

      const targetOptions = targets?.map(target => ({
        value: target.action.targetDisplay,
        label: target.action.targetDisplay,
      }));
      formFields.push(
        getFieldFromConfig({
          name: 'targetDisplay',
          type: 'select',
          required: true,
          options: targetOptions,
        })
      );
    }

    return formFields.map((element, i) => <Fragment key={i}>{element}</Fragment>);
  }

  function getFormProps() {
    if (action.id) {
      return {
        apiMethod: 'PUT' as const,
        apiEndpoint: `/organizations/${organization.slug}/notifications/actions/${action.id}/`,
      };
    }
    return {
      apiMethod: 'POST' as const,
      apiEndpoint: `/organizations/${organization.slug}/notifications/actions/`,
    };
  }

  function handleCancel() {
    if (action.id) {
      setIsEditing(false);
      return;
    }
    onDelete(index);
  }

  async function handleSave() {
    const formProps = getFormProps();
    addLoadingMessage();
    // TODO(cathy): use "requires" to get data to send
    const data = formRef.current.getData();
    delete data.sentryAppId;
    try {
      const resp = await api.requestPromise(formProps.apiEndpoint, {
        method: formProps.apiMethod,
        data: {...data, projects: [project.slug]},
      });
      addSuccessMessage(t('Successfully added notification action'));
      onUpdate(index, resp);
      setIsEditing(false);
    } catch (err) {
      addErrorMessage(t('Unable to add notification action'));
    }
  }

  return (
    <FormWrapper>
      <Form
        onSubmitError={() => addErrorMessage(t('Unable to save change'))}
        initialData={getInitialData()}
        model={formRef.current}
        submitLabel={t('Save')}
        hideFooter
      >
        <FormContentWrapper>
          <FormFields>{renderFormFields()}</FormFields>
          <Fragment>
            <Button onClick={handleCancel} size="xs">
              {t('Cancel')}
            </Button>
            <Button priority="primary" size="xs" onClick={handleSave}>
              {t('Save')}
            </Button>
          </Fragment>
        </FormContentWrapper>
      </Form>
    </FormWrapper>
  );
}

const FormWrapper = styled('div')``;

const FormContentWrapper = styled('div')`
  display: flex;
`;

const FormFields = styled('div')`
  display: inline-block;
  > * {
    display: inline-block !important;
    border-bottom: none !important;
  }
`;

// TODO(cathy): style form fields
const StyledSelectField = styled(SelectField)``;

const StyledTextField = styled(TextField)``;

export default NotificationActionForm;
