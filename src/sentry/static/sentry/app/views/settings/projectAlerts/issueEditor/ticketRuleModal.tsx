import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import AbstractExternalIssueForm from 'app/components/externalIssues/abstractExternalIssueForm';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {IssueConfigField, Organization} from 'app/types';
import {IssueAlertRuleAction, IssueAlertRuleCondition} from 'app/types/alerts';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';

type Props = ModalRenderProps & {
  formFields: {[key: string]: any};
  index: number;
  instance: IssueAlertRuleAction | IssueAlertRuleCondition;
  link?: string;
  onSubmitAction: (
    data: {[key: string]: string},
    dynamicFieldChoices: {[key: string]: string[]}
  ) => void;
  onPropertyChange: (rowIndex: number, name: string, value: string) => void;
  organization: Organization;
  ticketType?: string;
} & AbstractExternalIssueForm['props'];

type State = {
  dynamicFieldChoices: {[key: string]: string[]};
} & AbstractExternalIssueForm['state'];

class TicketRuleModal extends AbstractExternalIssueForm<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      dynamicFieldChoices: {},
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {instance, organization} = this.props;
    return [
      [
        'integrationDetails',
        `/organizations/${organization.slug}/integrations/${instance.integration}/?action=create`,
      ],
    ];
  }

  getNames = (): string[] => {
    const {formFields} = this.props;

    return Object.values(formFields)
      .filter(field => field.hasOwnProperty('name'))
      .map(field => field.name);
  };

  getEndPointString = () => {
    const {instance, organization} = this.props;
    return `/organizations/${organization.slug}/integrations/${instance.integration}/`;
  };

  cleanData = (data: {
    [key: string]: string;
  }): {
    integration?: string | number;
    [key: string]: any;
  } => {
    const {instance} = this.props;
    const names: string[] = this.getNames();
    const formData: {
      integration?: string | number;
      [key: string]: any;
    } = {};
    if (instance?.hasOwnProperty('integration')) {
      formData.integration = instance?.integration;
    }
    for (const [key, value] of Object.entries(data)) {
      if (names.includes(key)) {
        formData[key] = value;
      }
    }
    return formData;
  };

  onFormSubmit: Form['props']['onSubmit'] = (data, _success, _error, e, model) => {
    const {onSubmitAction, closeModal} = this.props;
    const {dynamicFieldChoices} = this.state;

    // This is a "fake form", so don't actually POST to an endpoint.
    e.preventDefault();
    e.stopPropagation();

    if (model.validateForm()) {
      onSubmitAction(this.cleanData(data), dynamicFieldChoices);
      addSuccessMessage(t('Changes applied.'));
      closeModal();
    }
  };

  updateDynamicFieldChoices = (field: IssueConfigField, result: any): void => {
    const dynamicFieldChoices = result.options.map(obj => [obj.value, obj.label]);
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, `dynamicFieldChoices[${field.name}]`, dynamicFieldChoices);
      return newState;
    });
  };

  getFormProps = (): Form['props'] => {
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
    const {formFields, instance} = this.props;
    const {integrationDetails} = this.state;

    const fields = (integrationDetails || {})[this.getConfigName()] || [];
    console.log('- cleanFields ----------------------------------');
    console.log('formFields', formFields);
    console.log('integrationDetails', integrationDetails);
    console.log('fields', fields);
    console.log('instance', instance);
    console.log('------------------------------------------------');

    return [
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
    ]
      .concat(formFields as IssueConfigField[])
      .concat(
        fields
          .filter(f => !['title', 'description'].includes(f.name))
          .map(field => {
            if (instance.hasOwnProperty(field.name)) {
              field.default = instance[field.name];
            }
            if (
              ['assignee', 'reporter'].includes(field.name) &&
              instance.dynamic_form_fields &&
              instance.dynamic_form_fields[field.name]
            ) {
              field.choices = instance.dynamic_form_fields[field.name].choices;
            }
            return field;
          }) || []
      );
  };

  renderBodyText = () => {
    const {ticketType, link} = this.props;
    return (
      <BodyText>
        {t(
          'When this alert is triggered a %s will be created with the following fields. ',
          ticketType
        )}
        {tct("It'll also [linkToDocs] with the new Sentry Issue.", {
          linkToDocs: <ExternalLink href={link}>{t('stay in sync')}</ExternalLink>,
        })}
      </BodyText>
    );
  };

  render() {
    return this.renderForm(this.cleanFields());
  }
}

const BodyText = styled('div')`
  margin-bottom: ${space(3)};
`;

export default TicketRuleModal;
