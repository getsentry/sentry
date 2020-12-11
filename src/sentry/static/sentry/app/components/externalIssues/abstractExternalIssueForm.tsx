import React from 'react';
import {Modal} from 'react-bootstrap';
import debounce from 'lodash/debounce';
import * as queryString from 'query-string';

import AsyncComponent from 'app/components/asyncComponent';
import {tct} from 'app/locale';
import {IntegrationIssueConfig, IssueConfigField} from 'app/types';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import Form from 'app/views/settings/components/forms/form';
import {FieldValue} from 'app/views/settings/components/forms/model';
import {FormField} from 'app/views/settings/projectAlerts/issueEditor/ruleNode';

export type ExternalIssueAction = 'create' | 'link';

type Props = {
  action: ExternalIssueAction;
} & AsyncComponent['props'];

type State = {
  integrationDetails: IntegrationIssueConfig | null;
  dynamicFieldValues: {[key: string]: FieldValue | null} | null;
} & AsyncComponent['state'];

const DEBOUNCE_MS = 200;

/**
 * @abstract
 */
export default class AbstractExternalIssueForm<
  P extends Props = Props,
  S extends State = State
> extends AsyncComponent<P, S> {
  shouldRenderBadRequests = true;
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      // This is derived from integrationDetails when it loads.
      dynamicFieldValues: null,
      // This is fetched by AsyncComponent.getEndpoints.
      integrationDetails: null,
    };
  }

  refetchConfig = () => {
    const {action} = this.props;
    const {dynamicFieldValues} = this.state;
    const query = {action, ...dynamicFieldValues};
    const endpoint = this.getEndPointString();

    this.api.request(endpoint, {
      method: 'GET',
      query,
      success: (data, _, jqXHR) => {
        this.handleRequestSuccess({stateKey: 'integrationDetails', data, jqXHR}, true);
      },
      error: error => {
        this.handleError(error, ['integrationDetails', endpoint, null, null]);
      },
    });
  };

  getConfigName = (): string => {
    // Explicitly returning a non-interpolated string for clarity.
    const {action} = this.props;
    switch (action) {
      case 'create':
        return 'createIssueConfig';
      case 'link':
        return 'linkIssueConfig';
      default:
        throw new Error('illegal action');
    }
  };

  getDynamicFields(
    integrationDetails?: IntegrationIssueConfig
  ): {[key: string]: FieldValue | null} {
    const config: IssueConfigField[] = (integrationDetails ||
      this.state.integrationDetails ||
      {})[this.getConfigName()];

    return Object.fromEntries(
      config
        .filter((field: IssueConfigField) => field.updatesForm)
        .map((field: IssueConfigField) => [field.name, field.default || null])
    );
  }

  onRequestSuccess({stateKey, data}) {
    if (stateKey === 'integrationDetails' && !this.state.dynamicFieldValues) {
      this.setState({
        dynamicFieldValues: this.getDynamicFields(data),
      });
    }
  }

  onFieldChange = (label: string, value: FieldValue) => {
    const {dynamicFieldValues} = this.state;
    const dynamicFields = this.getDynamicFields();
    if (dynamicFields.hasOwnProperty(label) && dynamicFieldValues) {
      dynamicFieldValues[label] = value;
      this.setState(
        {
          dynamicFieldValues,
          reloading: true,
          error: false,
          remainingRequests: 1,
        },
        this.refetchConfig
      );
    }
  };

  updateDynamicFieldChoices = (_field: IssueConfigField, _result: any): void => {
    // Do nothing.
  };

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
          this.updateDynamicFieldChoices(field, result);
          resolve(result);
        }
      });
    });

  debouncedOptionLoad = debounce(
    async (
      field: IssueConfigField,
      input: string,
      cb: (err: Error | null, result?: any) => void
    ) => {
      const query = queryString.stringify({
        ...this.state.dynamicFieldValues,
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
    DEBOUNCE_MS,
    {trailing: true}
  );

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

  // Abstract methods.
  getEndPointString = () => '';
  renderNavTabs = () => <React.Fragment />;
  renderBodyText = () => <React.Fragment />;
  getTitle = () => tct('Issue Link Settings', {});
  getFormProps = (): Form['props'] => {
    throw new Error("Method 'getFormProps()' must be implemented.");
  };

  getDefaultFormProps = (): Form['props'] => {
    return {
      footerClass: 'modal-footer',
      onFieldChange: this.onFieldChange,
      submitDisabled: this.state.reloading,
      // Other form props implemented by child classes.
    };
  };

  renderForm(formFields: IssueConfigField[]) {
    const initialData = formFields.reduce(
      (accumulator: {[key: string]: any}, field: FormField) => {
        // passing an empty array breaks multi select
        // TODO(jess): figure out why this is breaking and fix
        if (!accumulator.hasOwnProperty(field.name)) {
          accumulator[field.name] = field.multiple ? '' : field.default;
        }
        return accumulator;
      },
      {}
    );

    return (
      <React.Fragment>
        <Modal.Header closeButton>
          <Modal.Title>{this.getTitle()}</Modal.Title>
        </Modal.Header>
        {this.renderNavTabs()}
        <Modal.Body>
          {this.renderBodyText()}
          <Form initialData={initialData} {...this.getFormProps()}>
            {formFields
              .filter((field: FormField) => field.hasOwnProperty('name'))
              .map(field => (
                <FieldFromConfig
                  key={`${field.name}-${field.default}-${field.required}`}
                  field={field}
                  inline={false}
                  stacked
                  flexibleControlStateSize
                  disabled={this.state.reloading}
                  {...this.getFieldProps(field)}
                />
              ))}
          </Form>
        </Modal.Body>
      </React.Fragment>
    );
  }
}
