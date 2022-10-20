import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import AbstractExternalIssueForm, {
  ExternalIssueFormErrors,
} from 'sentry/components/externalIssues/abstractExternalIssueForm';
import {FormProps} from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Choices, IssueConfigField, Organization} from 'sentry/types';
import {IssueAlertRuleAction} from 'sentry/types/alerts';
import AsyncView from 'sentry/views/asyncView';

const IGNORED_FIELDS = ['Sprint'];

type Props = {
  // Comes from the in-code definition of a `TicketEventAction`.
  formFields: {[key: string]: any};
  index: number;
  // The AlertRuleAction from DB.
  instance: IssueAlertRuleAction;
  onSubmitAction: (
    data: {[key: string]: string},
    fetchedFieldOptionsCache: Record<string, Choices>
  ) => void;
  organization: Organization;
  link?: string;
  ticketType?: string;
} & AbstractExternalIssueForm['props'];

type State = {
  issueConfigFieldsCache: IssueConfigField[];
} & AbstractExternalIssueForm['state'];

class TicketRuleModal extends AbstractExternalIssueForm<Props, State> {
  getDefaultState(): State {
    const {instance} = this.props;
    const issueConfigFieldsCache = Object.values(instance?.dynamic_form_fields || {});
    return {
      ...super.getDefaultState(),
      fetchedFieldOptionsCache: Object.fromEntries(
        issueConfigFieldsCache.map(field => [field.name, field.choices as Choices])
      ),
      issueConfigFieldsCache,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {instance} = this.props;
    const query = (instance.dynamic_form_fields || [])
      .filter(field => field.updatesForm)
      .filter(field => instance.hasOwnProperty(field.name))
      .reduce(
        (accumulator, {name}) => {
          accumulator[name] = instance[name];
          return accumulator;
        },
        {action: 'create'}
      );
    return [['integrationDetails', this.getEndPointString(), {query}]];
  }

  handleReceiveIntegrationDetails = (integrationDetails: any) => {
    this.setState({
      issueConfigFieldsCache: integrationDetails[this.getConfigName()],
    });
  };

  /**
   * Get a list of formFields names with valid config data.
   */
  getValidAndSavableFieldNames = (): string[] => {
    const {issueConfigFieldsCache} = this.state;
    return (issueConfigFieldsCache || [])
      .filter(field => field.hasOwnProperty('name'))
      .map(field => field.name);
  };

  getEndPointString(): string {
    const {instance, organization} = this.props;
    return `/organizations/${organization.slug}/integrations/${instance.integration}/?ignored=${IGNORED_FIELDS}`;
  }

  /**
   * Clean up the form data before saving it to state.
   */
  cleanData = (data: {
    [key: string]: string;
  }): {
    [key: string]: any;
    integration?: string | number;
  } => {
    const {instance} = this.props;
    const {issueConfigFieldsCache} = this.state;
    const names: string[] = this.getValidAndSavableFieldNames();
    const formData: {
      [key: string]: any;
      integration?: string | number;
    } = {};
    if (instance?.hasOwnProperty('integration')) {
      formData.integration = instance.integration;
    }
    formData.dynamic_form_fields = issueConfigFieldsCache;
    for (const [key, value] of Object.entries(data)) {
      if (names.includes(key)) {
        formData[key] = value;
      }
    }
    return formData;
  };

  onFormSubmit: FormProps['onSubmit'] = (data, _success, _error, e, model) => {
    const {onSubmitAction, closeModal} = this.props;
    const {fetchedFieldOptionsCache} = this.state;

    // This is a "fake form", so don't actually POST to an endpoint.
    e.preventDefault();
    e.stopPropagation();

    if (model.validateForm()) {
      onSubmitAction(this.cleanData(data), fetchedFieldOptionsCache);
      addSuccessMessage(t('Changes applied.'));
      closeModal();
    }
  };

  getFormProps = (): FormProps => {
    const {closeModal} = this.props;

    return {
      ...this.getDefaultFormProps(),
      cancelLabel: t('Close'),
      onCancel: closeModal,
      onSubmit: this.onFormSubmit,
      submitLabel: t('Apply Changes'),
    };
  };

  /**
   * Set the initial data from the Rule, replace `title` and `description` with
   * disabled inputs, and use the cached dynamic choices.
   */
  cleanFields = (): IssueConfigField[] => {
    const {instance} = this.props;

    const fields: IssueConfigField[] = [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'This will be the same as the Sentry Issue.',
        disabled: true,
      } as IssueConfigField,
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        default: 'This will be generated from the Sentry Issue details.',
        disabled: true,
      } as IssueConfigField,
    ];

    return fields.concat(
      this.getCleanedFields()
        // Skip fields if they already exist.
        .filter(field => !fields.map(f => f.name).includes(field.name))
        .map(field => {
          // Overwrite defaults from cache.
          if (instance.hasOwnProperty(field.name)) {
            field.default = instance[field.name] || field.default;
          }
          return field;
        })
    );
  };

  getErrors() {
    const errors: ExternalIssueFormErrors = {};
    for (const field of this.cleanFields()) {
      if (field.type === 'select' && field.default) {
        const fieldChoices = (field.choices || []) as Choices;
        const found = fieldChoices.find(([value, _]) =>
          Array.isArray(field.default)
            ? field.default.includes(value)
            : value === field.default
        );

        if (!found) {
          errors[field.name] = (
            <FieldErrorLabel>{`Could not fetch saved option for ${field.label}. Please reselect.`}</FieldErrorLabel>
          );
        }
      }
    }
    return errors;
  }

  renderBodyText = () => {
    // `ticketType` already includes indefinite article.
    const {ticketType, link} = this.props;
    return (
      <BodyText>
        {tct(
          'When this alert is triggered [ticketType] will be created with the following fields. It will also [linkToDocs] with the new Sentry Issue.',
          {
            linkToDocs: <ExternalLink href={link}>{t('stay in sync')}</ExternalLink>,
            ticketType,
          }
        )}
      </BodyText>
    );
  };

  render() {
    return this.renderForm(this.cleanFields(), this.getErrors());
  }
}

const BodyText = styled('div')`
  margin-bottom: ${space(3)};
`;

const FieldErrorLabel = styled('label')`
  padding-bottom: ${space(2)};
  color: ${p => p.theme.errorText};
`;

export default TicketRuleModal;
