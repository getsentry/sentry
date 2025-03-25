import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {ExternalForm} from 'sentry/components/externalIssues/externalForm';
import {
  debouncedOptionLoad,
  ensureCurrentOption,
  type ExternalIssueAction,
  type ExternalIssueFormErrors,
  getConfigName,
  getDefaultOptions,
  getDynamicFields,
  getFieldProps,
  getOptions,
  hasErrorInFields,
  loadAsyncThenFetchAllFields,
} from 'sentry/components/externalIssues/utils';
import type {FormProps} from 'sentry/components/forms/form';
import type {FieldValue} from 'sentry/components/forms/model';
import FormModel from 'sentry/components/forms/model';
import {tct} from 'sentry/locale';
import type {Choices, SelectValue} from 'sentry/types/core';
import type {IntegrationIssueConfig, IssueConfigField} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import type {FormField} from 'sentry/views/alerts/rules/issue/ruleNode';

type Props = ModalRenderProps & DeprecatedAsyncComponent['props'];

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
} & DeprecatedAsyncComponent['state'];

/**
 * @abstract
 */
export default class AbstractExternalIssueForm<
  P extends Props = Props,
  S extends State = State,
> extends DeprecatedAsyncComponent<P, S> {
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
    return getConfigName(this.state.action);
  };

  getDynamicFields = (
    integrationDetailsParam?: IntegrationIssueConfig
  ): {[key: string]: FieldValue | null} => {
    return getDynamicFields({
      action: this.state.action,
      integrationDetails: defined(integrationDetailsParam)
        ? integrationDetailsParam
        : this.state.integrationDetails,
    });
  };

  onRequestSuccess = ({stateKey, data}: any) => {
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
    result: Array<SelectValue<string | number>>
  ): void => {
    const {fetchedFieldOptionsCache} = this.state;
    this.setState({
      fetchedFieldOptionsCache: {
        ...fetchedFieldOptionsCache,
        [field.name]: result.map(obj => [obj.value, obj.label]),
      },
    });
  };

  ensureCurrentOption = (
    field: IssueConfigField,
    result: Array<SelectValue<string | number>>
  ): Array<SelectValue<string | number>> => {
    return ensureCurrentOption({field, result, model: this.model});
  };

  getOptions = (field: IssueConfigField, input: string) => {
    return getOptions({
      field,
      input,
      model: this.model,
      dynamicFieldValues: this.state.dynamicFieldValues || {},
      successCallback: params => {
        this.updateFetchedFieldOptionsCache(params.field, params.result);
      },
    });
  };

  debouncedOptionLoad = (
    field: IssueConfigField,
    input: string,
    callback: (err: Error | null, result?: any) => void
  ) => {
    return debouncedOptionLoad({
      field,
      input,
      callback,
      dynamicFieldValues: this.state.dynamicFieldValues || {},
    });
  };

  getDefaultOptions = (field: IssueConfigField) => {
    return getDefaultOptions({field});
  };

  getFieldProps = (field: IssueConfigField) => {
    return getFieldProps({
      field,
      loadOptions: (input: string) => this.getOptions(field, input),
    });
  };

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
  getFormProps = (): FormProps => {
    throw new Error("Method 'getFormProps()' must be implemented.");
  };

  hasErrorInFields = (): boolean => {
    return hasErrorInFields({fields: this.loadAsyncThenFetchAllFields()});
  };

  getDefaultFormProps = (): FormProps => {
    return {
      footerClass: 'modal-footer',
      onFieldChange: this.onFieldChange,
      submitDisabled: this.state.reloading || this.hasErrorInFields(),
      model: this.model,
      // Other form props implemented by child classes.
    };
  };

  /**
   * Populate all async fields with their choices, then return the full list of fields.
   * We pull from the fetchedFieldOptionsCache which contains the most recent choices
   * for each async field.
   */
  loadAsyncThenFetchAllFields = (): IssueConfigField[] => {
    return loadAsyncThenFetchAllFields({
      configName: this.getConfigName(),
      integrationDetails: this.state.integrationDetails,
      fetchedFieldOptionsCache: this.state.fetchedFieldOptionsCache,
    });
  };

  renderComponent() {
    return this.state.error ? this.renderError() : this.renderBody();
  }

  renderForm = (
    formFields?: IssueConfigField[],
    errors: ExternalIssueFormErrors = {}
  ) => {
    const {Header, Body} = this.props as ModalRenderProps;
    const initialData: {[key: string]: any} = (formFields || []).reduce(
      (accumulator, field: FormField) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        accumulator[field.name] = field.default;
        return accumulator;
      },
      {}
    );

    return (
      <ExternalForm
        Header={Header}
        Body={Body}
        formFields={formFields}
        errors={errors}
        isLoading={this.shouldRenderLoading}
        formProps={{
          ...this.getFormProps(),
          initialData,
        }}
        title={this.getTitle()}
        navTabs={this.renderNavTabs()}
        bodyText={this.renderBodyText()}
        getFieldProps={this.getFieldProps}
      />
    );
  };
}
