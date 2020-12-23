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
import {IssueConfigField, IssueConfigFieldChoices, Organization} from 'app/types';
import {IssueAlertRuleAction} from 'app/types/alerts';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';

type Props = ModalRenderProps & {
  // Comes from the in-code definition of a `TicketEventAction`.
  formFields: {[key: string]: any};
  index: number;
  // The AlertRuleAction from DB.
  instance: IssueAlertRuleAction;
  link?: string;
  onSubmitAction: (
    data: {[key: string]: string},
    fetchedFieldOptionsCache: {[key: string]: IssueConfigFieldChoices}
  ) => void;
  organization: Organization;
  ticketType?: string;
} & AbstractExternalIssueForm['props'];

type State = {
  issueConfigFieldsCache: IssueConfigField[];
  fetchedFieldOptionsCache: {[key: string]: IssueConfigFieldChoices};
} & AbstractExternalIssueForm['state'];

class TicketRuleModal extends AbstractExternalIssueForm<Props, State> {
  getDefaultState(): State {
    const {instance} = this.props;
    const issueConfigFieldsCache = Object.values(instance?.dynamic_form_fields || {});
    return {
      ...super.getDefaultState(),
      fetchedFieldOptionsCache: Object.fromEntries(
        issueConfigFieldsCache.map(field => [
          field.name,
          field.choices as IssueConfigFieldChoices,
        ])
      ),
      issueConfigFieldsCache,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {instance, organization} = this.props;
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
    return [
      [
        'integrationDetails',
        `/organizations/${organization.slug}/integrations/${instance.integration}/`,
        {query},
      ],
    ];
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

  getEndPointString = (): string => {
    const {instance, organization} = this.props;
    return `/organizations/${organization.slug}/integrations/${instance.integration}/`;
  };

  /**
   * Clean up the form data before saving it to state.
   */
  cleanData = (data: {
    [key: string]: string;
  }): {
    integration?: string | number;
    [key: string]: any;
  } => {
    const {instance} = this.props;
    const {issueConfigFieldsCache} = this.state;
    const names: string[] = this.getValidAndSavableFieldNames();
    const formData: {
      integration?: string | number;
      [key: string]: any;
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

  onFormSubmit: Form['props']['onSubmit'] = (data, _success, _error, e, model) => {
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

  updateFetchedFieldOptionsCache = (
    field: IssueConfigField,
    result: {options: {value: string; label: string}[]}
  ): void => {
    const fetchedFieldOptionsCache = result.options.map(obj => [obj.value, obj.label]);
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, `fetchedFieldOptionsCache[${field.name}]`, fetchedFieldOptionsCache);
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
    const {instance} = this.props;
    const {fetchedFieldOptionsCache, integrationDetails} = this.state;

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

    const configsFromAPI = (integrationDetails || {})[this.getConfigName()];
    return fields.concat(
      (configsFromAPI || [])
        // Skip fields if they already exist.
        .filter(field => !fields.map(f => f.name).includes(field.name))
        .map(field => {
          // Overwrite defaults from cache.
          if (instance.hasOwnProperty(field.name)) {
            field.default = instance[field.name] || field.default;
          }

          // Overwrite choices from cache.
          if (fetchedFieldOptionsCache?.hasOwnProperty(field.name)) {
            field.choices = fetchedFieldOptionsCache[field.name];
          }

          return field;
        })
    );
  };

  renderBodyText = () => {
    // `ticketType` already includes indefinite article.
    const {ticketType, link} = this.props;
    return (
      <BodyText>
        {tct(
          'When this alert is triggered [ticketType] will be ' +
            'created with the following fields. It will also [linkToDocs] ' +
            'with the new Sentry Issue.',
          {
            linkToDocs: <ExternalLink href={link}>{t('stay in sync')}</ExternalLink>,
            ticketType,
          }
        )}
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
