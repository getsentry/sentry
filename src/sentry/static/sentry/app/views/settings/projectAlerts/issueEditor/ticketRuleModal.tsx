import React from 'react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import debounce from 'lodash/debounce';
import set from 'lodash/set';
import * as queryString from 'query-string';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/components/globalModal';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {IssueConfigField} from 'app/types';
import {IssueAlertRuleAction, IssueAlertRuleCondition} from 'app/types/alerts';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import {FormField} from 'app/views/settings/projectAlerts/issueEditor/ruleNode';

type Props = ModalRenderProps & {
  formFields: {[key: string]: any};
  link?: string;
  ticketType?: string;
  instance?: IssueAlertRuleAction | IssueAlertRuleCondition;
  onSubmitAction: (
    data: {[key: string]: string},
    dynamicFieldChoices: {[key: string]: string[]}
  ) => void;
  onPropertyChange: (rowIndex: number, name: string, value: string) => void;
  index: number;
};

type State = {
  dynamicFieldChoices: {[key: string]: string[]};
};

class TicketRuleModal extends React.Component<Props, State> {
  state: State = {
    dynamicFieldChoices: {},
  };

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

    e.preventDefault();
    e.stopPropagation();

    const formData = this.cleanData(data);
    onSubmitAction(formData, this.state.dynamicFieldChoices);
    addSuccessMessage(t('Changes applied.'));
    closeModal();
  };

  debouncedOptionLoad = debounce(
    async (
      field: IssueConfigField,
      input: string,
      cb: (err: Error | null, result?: any) => void
    ) => {
      const options = this.props.instance;
      const query = queryString.stringify({
        project: options?.project,
        issuetype: options?.issuetype,
        field: field.name,
        query: input,
      });

      const url = field.url || '';
      const separator = url.includes('?') ? '&' : '?';
      // We can't use the API client here since the URL is not scoped under the
      // API endpoints (which the client prefixes)
      try {
        const response = await fetch(url + separator + query);
        cb(null, {options: response.ok ? await response.json() : []});
      } catch (err) {
        cb(err);
      }
    },
    200,
    {trailing: true}
  );

  getOptions = (field: IssueConfigField, input: string) =>
    new Promise((resolve, reject) => {
      if (!input) {
        const choices =
          (field.choices as Array<[number | string, number | string]>) || [];
        const options = choices.map(([value, label]) => ({value, label}));
        return resolve({options});
      }

      return this.debouncedOptionLoad(field, input, (err, result) => {
        if (err) {
          reject(err);
        } else {
          const dynamicFieldChoices = result.options.map(obj => [obj.value, obj.label]);
          this.setState(prevState => {
            const newState = cloneDeep(prevState);
            set(newState, `dynamicFieldChoices[${field.name}]`, dynamicFieldChoices);
            return newState;
          });
          resolve(result);
        }
      });
    });

  getFieldProps = (field: IssueConfigField) =>
    field.url
      ? {
          loadOptions: (input: string) => this.getOptions(field, input),
          async: true,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: true,
        }
      : {};

  addFields = (fields: FormField[]): void => {
    const title = {
      name: 'title',
      label: 'Title',
      type: 'string',
      default: 'This will be the same as the Sentry Issue.',
      disabled: true,
    };
    const description = {
      name: 'description',
      label: 'Description',
      type: 'string',
      default: 'This will be generated from the Sentry Issue details.',
      disabled: true,
    };
    fields.unshift(description);
    fields.unshift(title);
  };

  render() {
    const {Header, Body, formFields, closeModal, link, ticketType, instance} = this.props;

    const text = t(
      'When this alert is triggered %s will be created with the following fields. ',
      ticketType
    );

    const submitLabel = t('Apply Changes');
    const cancelLabel = t('Close');
    const fields = Object.values(formFields);
    this.addFields(fields);
    const initialData = instance || {};
    fields.forEach((field: FormField) => {
      // passing an empty array breaks multi select
      // TODO(jess): figure out why this is breaking and fix
      if (!initialData.hasOwnProperty(field.name)) {
        initialData[field.name] = field.multiple ? '' : field.default;
      }
    });

    return (
      <React.Fragment>
        <Header closeButton>{t('Issue Link Settings')}</Header>
        <Body>
          <BodyText>
            {text}
            {tct("It'll also [linkToDocs] with the new Sentry Issue.", {
              linkToDocs: <ExternalLink href={link}>{t('stay in sync')}</ExternalLink>,
            })}
          </BodyText>
          <Form
            onSubmit={this.onFormSubmit}
            initialData={initialData}
            submitLabel={submitLabel}
            cancelLabel={cancelLabel}
            footerClass="modal-footer"
            onCancel={closeModal}
          >
            {fields
              .filter((field: FormField) => field.hasOwnProperty('name'))
              .map((field: IssueConfigField) => (
                <FieldFromConfig
                  key={`${field.name}-${field.default}-${field.required}`}
                  field={field}
                  inline={false}
                  stacked
                  flexibleControlStateSize
                  {...this.getFieldProps(field)}
                />
              ))}
          </Form>
        </Body>
      </React.Fragment>
    );
  }
}

const BodyText = styled('div')`
  margin-bottom: ${space(3)};
`;

export default TicketRuleModal;
