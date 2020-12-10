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
import {FormField} from 'app/views/settings/projectAlerts/issueEditor/ruleNode';

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
  constructor(props: Props, context: any) {
    super(props, context);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      dynamicFieldValues: {},
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

    const names: string[] = [];
    for (const name in formFields) {
      if (formFields[name].hasOwnProperty('name')) {
        names.push(formFields[name].name);
      }
    }
    return names;
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

  onFormSubmit: Form['props']['onSubmit'] = (data, _success, _error, e) => {
    const {onSubmitAction, closeModal} = this.props;
    const {dynamicFieldChoices} = this.state;

    e.preventDefault();
    e.stopPropagation();

    const formData = this.cleanData(data);
    onSubmitAction(formData, dynamicFieldChoices);
    addSuccessMessage(t('Changes applied.'));
    closeModal();
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
   * Set the order of the fields for the modal and replace `title` and `description`.
   */
  cleanFields = (): FormField[] => {
    const {formFields} = this.props;
    return [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'This will be the same as the Sentry Issue.',
        disabled: true,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'string',
        default: 'This will be generated from the Sentry Issue details.',
        disabled: true,
      },
    ].concat(
      Object.values(formFields).filter(f => !['title', 'description'].includes(f.name))
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
    const {instance} = this.props;
    return this.renderForm(this.cleanFields(), instance);
  }
}

const BodyText = styled('div')`
  margin-bottom: ${space(3)};
`;

export default TicketRuleModal;
