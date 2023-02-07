import {Component} from 'react';
import {createFilter} from 'react-select';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {GeneralSelectValue} from 'sentry/components/forms/controls/selectControl';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {Field, FieldValue} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {replaceAtArrayIndex} from 'sentry/utils/replaceAtArrayIndex';
import withApi from 'sentry/utils/withApi';

// 0 is a valid choice but empty string, undefined, and null are not
const hasValue = value => !!value || value === 0;

// See docs: https://docs.sentry.io/product/integrations/integration-platform/ui-components/formfield/
export type FieldFromSchema = Omit<Field, 'choices' | 'type'> & {
  type: 'select' | 'textarea' | 'text';
  async?: boolean;
  choices?: Array<[any, string]>;
  default?: 'issue.title' | 'issue.description';
  depends_on?: string[];
  uri?: string;
};

export type SchemaFormConfig = {
  description: string | null;
  uri: string;
  optional_fields?: FieldFromSchema[];
  required_fields?: FieldFromSchema[];
};

type SentryAppSetting = {
  name: string;
  value: any;
  label?: string;
};

// only need required_fields and optional_fields
type State = Omit<SchemaFormConfig, 'uri' | 'description'> & {
  optionsByField: Map<string, Array<{label: string; value: any}>>;
  selectedOptions: {[name: string]: GeneralSelectValue};
};

type Props = {
  action: 'create' | 'link';
  api: Client;
  appName: string;
  config: SchemaFormConfig;
  element: 'issue-link' | 'alert-rule-action';
  onSubmitSuccess: Function;
  sentryAppInstallationUuid: string;
  /**
   * Additional form data to submit with the request
   */
  extraFields?: {[key: string]: any};
  /**
   * Additional body parameters to submit with the request
   */
  extraRequestBody?: {[key: string]: any};
  /**
   * Function to provide fields with pre-written data if a default is specified
   */
  getFieldDefault?: (field: FieldFromSchema) => string;
  /**
   * Object containing reset values for fields if previously entered, in case this form is unmounted
   */
  resetValues?: {
    [key: string]: any;
    settings?: SentryAppSetting[];
  };
};

/**
 *  This component is the result of a refactor of sentryAppExternalIssueForm.tsx.
 *  Most of it contains a direct copy of the code from that original file (comments included)
 *  to allow for an abstract way of turning Sentry App Schema -> Form UI, rather than being
 *  specific to Issue Linking.
 *
 *  See (#28465) for more details.
 */
export class SentryAppExternalForm extends Component<Props, State> {
  state: State = {optionsByField: new Map(), selectedOptions: {}};

  componentDidMount() {
    this.resetStateFromProps();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.action !== this.props.action) {
      this.model.reset();
      this.resetStateFromProps();
    }
  }

  model = new FormModel();

  // reset the state when we mount or the action changes
  resetStateFromProps() {
    const {config, action, extraFields, element} = this.props;
    this.setState({
      required_fields: config.required_fields,
      optional_fields: config.optional_fields,
    });
    // For alert-rule-actions, the forms are entirely custom, extra fields are
    // passed in on submission, not as part of the form. See handleAlertRuleSubmit().
    if (element === 'alert-rule-action') {
      const defaultResetValues = (this.props.resetValues || {}).settings || [];
      const initialData = defaultResetValues.reduce((acc, curr) => {
        acc[curr.name] = curr.value;
        return acc;
      }, {});
      this.model.setInitialData({...initialData});
    } else {
      this.model.setInitialData({
        ...extraFields,
        // we need to pass these fields in the API so just set them as values so we don't need hidden form fields
        action,
        uri: config.uri,
      });
    }
  }

  onSubmitError = () => {
    const {action, appName} = this.props;
    addErrorMessage(t('Unable to %s %s %s.', action, appName, this.getElementText()));
  };

  getOptions = (field: FieldFromSchema, input: string) =>
    new Promise(resolve => {
      this.debouncedOptionLoad(field, input, resolve);
    });

  getElementText = () => {
    const {element} = this.props;
    switch (element) {
      case 'issue-link':
        return 'issue';
      case 'alert-rule-action':
        return 'alert';
      default:
        return 'connection';
    }
  };

  getDefaultOptions = (field: FieldFromSchema) => {
    const savedOption = ((this.props.resetValues || {}).settings || []).find(
      value => value.name === field.name
    );
    const currentOptions = (field.choices || []).map(([value, label]) => ({
      value,
      label,
    }));

    const shouldAddSavedOption =
      // We only render saved options if they have preserved the label, otherwise it appears unselcted.
      // The next time the user saves, the label should be preserved.
      savedOption?.value &&
      savedOption?.label &&
      // The option isn't in the current options already
      !currentOptions.some(option => option.value === savedOption?.value);

    return shouldAddSavedOption
      ? [{value: savedOption.value, label: savedOption.label}, ...currentOptions]
      : currentOptions;
  };

  getDefaultFieldValue = (field: FieldFromSchema) => {
    // Interpret the default if a getFieldDefault function is provided.
    const {resetValues, getFieldDefault} = this.props;
    let defaultValue = field?.defaultValue;

    // Override this default if a reset value is provided
    if (field.default && getFieldDefault) {
      defaultValue = getFieldDefault(field);
    }

    const reset = ((resetValues || {}).settings || []).find(
      value => value.name === field.name
    );

    if (reset) {
      defaultValue = reset.value;
    }
    return defaultValue;
  };

  debouncedOptionLoad = debounce(
    // debounce is used to prevent making a request for every input change and
    // instead makes the requests every 200ms
    async (field: FieldFromSchema, input, resolve) => {
      const choices = await this.makeExternalRequest(field, input);
      const options = choices.map(([value, label]) => ({value, label}));
      const optionsByField = new Map(this.state.optionsByField);
      optionsByField.set(field.name, options);
      this.setState({
        optionsByField,
      });
      return resolve(options);
    },
    200,
    {trailing: true}
  );

  makeExternalRequest = async (field: FieldFromSchema, input: FieldValue) => {
    const {extraRequestBody = {}, sentryAppInstallationUuid} = this.props;
    const query: {[key: string]: any} = {
      ...extraRequestBody,
      uri: field.uri,
      query: input,
    };

    if (field.depends_on) {
      const dependentData = field.depends_on.reduce((accum, dependentField: string) => {
        accum[dependentField] = this.model.getValue(dependentField);
        return accum;
      }, {});
      // stringify the data
      query.dependentData = JSON.stringify(dependentData);
    }

    const {choices} = await this.props.api.requestPromise(
      `/sentry-app-installations/${sentryAppInstallationUuid}/external-requests/`,
      {query}
    );
    return choices || [];
  };

  /**
   * This function determines which fields need to be reset and new options fetched
   * based on the dependencies defined with the depends_on attribute.
   * This is done because the autoload flag causes fields to load at different times
   * if you have multiple dependent fields while this solution updates state at once.
   */
  handleFieldChange = async (id: string) => {
    const config = this.state;

    let requiredFields = config.required_fields || [];
    let optionalFields = config.optional_fields || [];

    const fieldList: FieldFromSchema[] = requiredFields.concat(optionalFields);

    // could have multiple impacted fields
    const impactedFields = fieldList.filter(({depends_on}) => {
      if (!depends_on) {
        return false;
      }
      // must be dependent on the field we just set
      return depends_on.includes(id);
    });

    // load all options in parallel
    const choiceArray = await Promise.all(
      impactedFields.map(field => {
        // reset all impacted fields first
        this.model.setValue(field.name || '', '', {quiet: true});
        return this.makeExternalRequest(field, '');
      })
    );

    this.setState(state => {
      // pull the field lists from latest state
      requiredFields = state.required_fields || [];
      optionalFields = state.optional_fields || [];
      // iterate through all the impacted fields and get new values
      impactedFields.forEach((impactedField, i) => {
        const choices = choiceArray[i];
        const requiredIndex = requiredFields.indexOf(impactedField);
        const optionalIndex = optionalFields.indexOf(impactedField);

        const updatedField = {...impactedField, choices};

        // immutably update the lists with the updated field depending where we got it from
        if (requiredIndex > -1) {
          requiredFields = replaceAtArrayIndex(
            requiredFields,
            requiredIndex,
            updatedField
          );
        } else if (optionalIndex > -1) {
          optionalFields = replaceAtArrayIndex(
            optionalFields,
            optionalIndex,
            updatedField
          );
        }
      });
      return {
        required_fields: requiredFields,
        optional_fields: optionalFields,
      };
    });
  };

  createPreserveOptionFunction = (name: string) => (option, _event) => {
    this.setState({
      selectedOptions: {
        ...this.state.selectedOptions,
        [name]: option,
      },
    });
  };

  renderField = (field: FieldFromSchema, required: boolean) => {
    // This function converts the field we get from the backend into
    // the field we need to pass down
    let fieldToPass: Field = {
      ...field,
      inline: false,
      stacked: true,
      flexibleControlStateSize: true,
      required,
    };
    if (field?.uri && field?.async) {
      fieldToPass.type = 'select_async';
    }
    if (['select', 'select_async'].includes(fieldToPass.type || '')) {
      // find the options from state to pass down
      const defaultOptions = this.getDefaultOptions(field);
      const options = this.state.optionsByField.get(field.name) || defaultOptions;

      fieldToPass = {
        ...fieldToPass,
        options,
        defaultOptions,
        defaultValue: this.getDefaultFieldValue(field),
        // filter by what the user is typing
        filterOption: createFilter({}),
        allowClear: !required,
        placeholder: 'Type to search',
      } as Field;
      if (field.depends_on) {
        // check if this is dependent on other fields which haven't been set yet
        const shouldDisable = field.depends_on.some(
          dependentField => !hasValue(this.model.getValue(dependentField))
        );
        if (shouldDisable) {
          fieldToPass = {...fieldToPass, disabled: true};
        }
      }
    }
    if (['text', 'textarea'].includes(fieldToPass.type || '')) {
      fieldToPass = {
        ...fieldToPass,
        defaultValue: this.getDefaultFieldValue(field),
      };
    }

    // if we have a uri, we need to set extra parameters
    const extraProps = field.uri
      ? {
          loadOptions: (input: string) => this.getOptions(field, input),
          async: field?.async ?? true,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: false,
          onChangeOption: this.createPreserveOptionFunction(field.name),
        }
      : {};

    return (
      <FieldFromConfig
        key={field.name}
        field={fieldToPass}
        data-test-id={field.name}
        {...extraProps}
      />
    );
  };

  handleAlertRuleSubmit = (formData, onSubmitSuccess) => {
    const {sentryAppInstallationUuid} = this.props;
    if (this.model.validateForm()) {
      onSubmitSuccess({
        // The form data must be nested in 'settings' to ensure they don't overlap with any other field names.
        settings: Object.entries(formData).map(([name, value]) => {
          const savedSetting: SentryAppSetting = {name, value};
          const stateOption = this.state.selectedOptions[name];
          // If the field is a SelectAsync, we need to preserve the label since the next time it's rendered,
          // we can't be sure the options will contain this selection
          if (stateOption?.value === value) {
            savedSetting.label = `${stateOption?.label}`;
          }
          return savedSetting;
        }),
        sentryAppInstallationUuid,
        // Used on the backend to explicitly associate with a different rule than those without a custom form.
        hasSchemaFormConfig: true,
      });
    }
  };

  render() {
    const {sentryAppInstallationUuid, action, element, onSubmitSuccess} = this.props;

    const requiredFields = this.state.required_fields || [];
    const optionalFields = this.state.optional_fields || [];

    if (!sentryAppInstallationUuid) {
      return '';
    }

    return (
      <Form
        key={action}
        apiEndpoint={`/sentry-app-installations/${sentryAppInstallationUuid}/external-issue-actions/`}
        apiMethod="POST"
        // Without defining onSubmit, the Form will send an `apiMethod` request to the above `apiEndpoint`
        onSubmit={
          element === 'alert-rule-action' ? this.handleAlertRuleSubmit : undefined
        }
        onSubmitSuccess={(...params) => {
          onSubmitSuccess(...params);
        }}
        onSubmitError={this.onSubmitError}
        onFieldChange={this.handleFieldChange}
        model={this.model}
      >
        {requiredFields.map((field: FieldFromSchema) => {
          return this.renderField(field, true);
        })}

        {optionalFields.map((field: FieldFromSchema) => {
          return this.renderField(field, false);
        })}
      </Form>
    );
  }
}

export default withApi(SentryAppExternalForm);
