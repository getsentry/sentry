import * as React from 'react';
import debounce from 'lodash/debounce';
import * as qs from 'query-string';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import AsyncComponent from 'sentry/components/asyncComponent';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import FormModel, {FieldValue} from 'sentry/components/forms/model';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {tct} from 'sentry/locale';
import {
  Choices,
  IntegrationIssueConfig,
  IssueConfigField,
  SelectValue,
} from 'sentry/types';
import {FormField} from 'sentry/views/alerts/issueRuleEditor/ruleNode';

export type ExternalIssueAction = 'create' | 'link';

type Props = ModalRenderProps & AsyncComponent['props'];

type State = {
  action: ExternalIssueAction;
  /**
   * Object of fields where `updatesFrom` is true, by field name. Derived from
   * `integrationDetails` when it loads. Null until set.
   */
  dynamicFieldValues: {[key: string]: FieldValue | null} | null;
  /**
   * Cache of options fetched for async fields.
   */
  fetchedFieldOptionsCache: Record<string, Choices>;
  /**
   * Fetched via endpoint, null until set.
   */
  integrationDetails: IntegrationIssueConfig | null;
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
  model = new FormModel();

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      action: 'create',
      dynamicFieldValues: null,
      fetchedFieldOptionsCache: {},
      integrationDetails: null,
    };
  }

  refetchConfig = () => {
    const {action, dynamicFieldValues} = this.state;
    const query = {action, ...dynamicFieldValues};
    const endpoint = this.getEndPointString();

    this.api.request(endpoint, {
      method: 'GET',
      query,
      success: (data, _, resp) => {
        this.handleRequestSuccess({stateKey: 'integrationDetails', data, resp}, true);
      },
      error: error => {
        this.handleError(error, ['integrationDetails', endpoint, null, null]);
      },
    });
  };

  getConfigName = (): 'createIssueConfig' | 'linkIssueConfig' => {
    // Explicitly returning a non-interpolated string for clarity.
    const {action} = this.state;
    switch (action) {
      case 'create':
        return 'createIssueConfig';
      case 'link':
        return 'linkIssueConfig';
      default:
        throw new Error('illegal action');
    }
  };

  /**
   * Convert IntegrationIssueConfig to an object that maps field names to the
   * values of fields where `updatesFrom` is true. This function prefers to read
   * configs from its parameters and otherwise falls back to reading from state.
   * @param integrationDetailsParam
   * @returns Object of field names to values.
   */
  getDynamicFields = (
    integrationDetailsParam?: IntegrationIssueConfig
  ): {[key: string]: FieldValue | null} => {
    const {integrationDetails: integrationDetailsFromState} = this.state;
    const integrationDetails = integrationDetailsParam || integrationDetailsFromState;
    const config = (integrationDetails || {})[this.getConfigName()];
    return Object.fromEntries(
      (config || [])
        .filter((field: IssueConfigField) => field.updatesForm)
        .map((field: IssueConfigField) => [field.name, field.default || null])
    );
  };

  onRequestSuccess = ({stateKey, data}) => {
    if (stateKey === 'integrationDetails') {
      this.handleReceiveIntegrationDetails(data);
      this.setState({
        dynamicFieldValues: this.getDynamicFields(data),
      });
    }
  };

  /**
   * If this field should updateForm, updateForm. Otherwise, do nothing.
   */
  onFieldChange = (fieldName: string, value: FieldValue) => {
    const {dynamicFieldValues} = this.state;
    const dynamicFields = this.getDynamicFields();
    if (dynamicFields.hasOwnProperty(fieldName) && dynamicFieldValues) {
      dynamicFieldValues[fieldName] = value;
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

  /**
   * For fields with dynamic fields, cache the fetched choices.
   */
  updateFetchedFieldOptionsCache = (
    field: IssueConfigField,
    result: SelectValue<string | number>[]
  ): void => {
    const {fetchedFieldOptionsCache} = this.state;
    this.setState({
      fetchedFieldOptionsCache: {
        ...fetchedFieldOptionsCache,
        [field.name]: result.map(obj => [obj.value, obj.label]),
      },
    });
  };

  /**
   * Ensures current result from Async select fields is never discarded. Without this method,
   * searching in an async select field without selecting one of the returned choices will
   * result in a value saved to the form, and no associated label; appearing empty.
   * @param field The field being examined
   * @param result The result from it's asynchronous query
   * @returns The result with a tooltip attached to the current option
   */
  ensureCurrentOption = (
    field: IssueConfigField,
    result: SelectValue<string | number>[]
  ): SelectValue<string | number>[] => {
    const currentOption = this.getDefaultOptions(field).find(
      option => option.value === this.model.getValue(field.name)
    );
    if (!currentOption) {
      return result;
    }
    if (typeof currentOption.label === 'string') {
      currentOption.label = (
        <React.Fragment>
          <QuestionTooltip
            title={tct('This is your current [label].', {
              label: field.label,
            })}
            size="xs"
          />{' '}
          {currentOption.label}
        </React.Fragment>
      );
    }
    const currentOptionResultIndex = result.findIndex(
      obj => obj.value === currentOption?.value
    );
    // Has a selected option, and it is in API results
    if (currentOptionResultIndex >= 0) {
      const newResult = result;
      newResult[currentOptionResultIndex] = currentOption;
      return newResult;
    }
    // Has a selected option, and it is not in API results

    return [...result, currentOption];
  };

  /**
   * Get the list of options for a field via debounced API call. For example,
   * the list of users that match the input string. The Promise rejects if there
   * are any errors.
   */
  getOptions = (field: IssueConfigField, input: string) =>
    new Promise((resolve, reject) => {
      if (!input) {
        return resolve(this.getDefaultOptions(field));
      }
      return this.debouncedOptionLoad(field, input, (err, result) => {
        if (err) {
          reject(err);
        } else {
          result = this.ensureCurrentOption(field, result);
          this.updateFetchedFieldOptionsCache(field, result);
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
      const {dynamicFieldValues} = this.state;
      const query = qs.stringify({
        ...dynamicFieldValues,
        field: field.name,
        query: input,
      });

      const url = field.url || '';
      const separator = url.includes('?') ? '&' : '?';
      // We can't use the API client here since the URL is not scoped under the
      // API endpoints (which the client prefixes)
      try {
        const response = await fetch(url + separator + query);
        cb(null, response.ok ? await response.json() : []);
      } catch (err) {
        cb(err);
      }
    },
    DEBOUNCE_MS,
    {trailing: true}
  );

  getDefaultOptions = (field: IssueConfigField) => {
    const choices =
      (field.choices as Array<[number | string, number | string | React.ReactElement]>) ||
      [];
    return choices.map(([value, label]) => ({value, label}));
  };

  /**
   * If this field is an async select (field.url is not null), add async props.
   */
  getFieldProps = (field: IssueConfigField) =>
    field.url
      ? {
          async: true,
          autoload: true,
          cache: false,
          loadOptions: (input: string) => this.getOptions(field, input),
          defaultOptions: this.getDefaultOptions(field),
          onBlurResetsInput: false,
          onCloseResetsInput: false,
          onSelectResetsInput: false,
        }
      : {};

  // Abstract methods.
  handleReceiveIntegrationDetails = (_data: any) => {
    // Do nothing.
  };
  getEndPointString(): string {
    throw new Error("Method 'getEndPointString()' must be implemented.");
  }
  renderNavTabs = (): React.ReactNode => null;
  renderBodyText = (): React.ReactNode => null;
  getTitle = () => tct('Issue Link Settings', {});
  getFormProps = (): Form['props'] => {
    throw new Error("Method 'getFormProps()' must be implemented.");
  };

  getDefaultFormProps = (): Form['props'] => {
    return {
      footerClass: 'modal-footer',
      onFieldChange: this.onFieldChange,
      submitDisabled: this.state.reloading,
      model: this.model,
      // Other form props implemented by child classes.
    };
  };

  getCleanedFields = (): IssueConfigField[] => {
    const {fetchedFieldOptionsCache, integrationDetails} = this.state;

    const configsFromAPI = (integrationDetails || {})[this.getConfigName()];
    return (configsFromAPI || []).map(field => {
      const fieldCopy = {...field};
      // Overwrite choices from cache.
      if (fetchedFieldOptionsCache?.hasOwnProperty(field.name)) {
        fieldCopy.choices = fetchedFieldOptionsCache[field.name];
      }

      return fieldCopy;
    });
  };

  renderComponent() {
    return this.state.error
      ? this.renderError(new Error('Unable to load all required endpoints'))
      : this.renderBody();
  }

  renderForm = (formFields?: IssueConfigField[]) => {
    const initialData: {[key: string]: any} = (formFields || []).reduce(
      (accumulator, field: FormField) => {
        accumulator[field.name] =
          // Passing an empty array breaks MultiSelect.
          field.multiple && field.default === [] ? '' : field.default;
        return accumulator;
      },
      {}
    );

    const {Header, Body} = this.props as ModalRenderProps;

    return (
      <React.Fragment>
        <Header closeButton>{this.getTitle()}</Header>
        {this.renderNavTabs()}
        <Body>
          {this.shouldRenderLoading ? (
            this.renderLoading()
          ) : (
            <React.Fragment>
              {this.renderBodyText()}
              <Form initialData={initialData} {...this.getFormProps()}>
                {(formFields || [])
                  .filter((field: FormField) => field.hasOwnProperty('name'))
                  .map(fields => ({
                    ...fields,
                    noOptionsMessage: () => 'No options. Type to search.',
                  }))
                  .map(field => (
                    <FieldFromConfig
                      disabled={this.state.reloading}
                      field={field}
                      flexibleControlStateSize
                      inline={false}
                      key={`${field.name}-${field.default}-${field.required}`}
                      stacked
                      {...this.getFieldProps(field)}
                    />
                  ))}
              </Form>
            </React.Fragment>
          )}
        </Body>
      </React.Fragment>
    );
  };
}
