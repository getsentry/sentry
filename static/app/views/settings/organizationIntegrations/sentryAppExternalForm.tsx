import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';

import type {GeneralSelectValue} from '@sentry/scraps/select';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {createFilter} from 'sentry/components/forms/controls/reactSelectWrapper';
import {FieldFromConfig} from 'sentry/components/forms/fieldFromConfig';
import {Form} from 'sentry/components/forms/form';
import {FormModel} from 'sentry/components/forms/model';
import type {Field, FieldValue, OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import {replaceAtArrayIndex} from 'sentry/utils/array/replaceAtArrayIndex';
import {useApi} from 'sentry/utils/useApi';

// 0 is a valid choice but empty string, undefined, and null are not
const hasValue = (value: any) => !!value || value === 0;

function getElementText(element: 'issue-link' | 'alert-rule-action') {
  if (element === 'issue-link') {
    return 'issue';
  }
  if (element === 'alert-rule-action') {
    return 'alert';
  }
  return 'connection';
}

// See docs: https://docs.sentry.io/product/integrations/integration-platform/ui-components/formfield/
export type FieldFromSchema = Omit<Field, 'choices' | 'type'> & {
  type: 'select' | 'textarea' | 'text';
  async?: boolean;
  choices?: Array<[any, string]>;
  default?: 'issue.title' | 'issue.description';
  depends_on?: string[];
  skip_load_on_open?: boolean;
  uri?: string;
};

export type SchemaFormConfig = {
  uri: string;
  description?: string;
  optional_fields?: FieldFromSchema[];
  required_fields?: FieldFromSchema[];
};

type SentryAppSetting = {
  name: string;
  value: any;
  label?: string;
};

type Props = {
  action: 'create' | 'link';
  appName: string;
  config: SchemaFormConfig;
  element: 'issue-link' | 'alert-rule-action';
  onSubmitSuccess: (
    response: any,
    instance: FormModel,
    id?: string,
    change?: {new: FieldValue; old: FieldValue}
  ) => void;
  sentryAppInstallationUuid: string;
  /**
   * Additional form data to submit with the request
   */
  extraFields?: Record<string, any>;
  /**
   * Additional body parameters to submit with the request
   */
  extraRequestBody?: Record<string, any>;
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

function getDefaultOptions(
  field: FieldFromSchema,
  resetSettings: SentryAppSetting[] | undefined
) {
  const savedOption = (resetSettings || []).find(value => value.name === field.name);
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
}

/**
 *  This component is the result of a refactor of sentryAppExternalIssueForm.tsx.
 *  Most of it contains a direct copy of the code from that original file (comments included)
 *  to allow for an abstract way of turning Sentry App Schema -> Form UI, rather than being
 *  specific to Issue Linking.
 *
 *  See (#28465) for more details.
 */
export function SentryAppExternalForm({
  action,
  appName,
  config,
  element,
  onSubmitSuccess,
  sentryAppInstallationUuid,
  extraFields,
  extraRequestBody,
  getFieldDefault,
  resetValues,
}: Props) {
  const api = useApi();

  const modelRef = useRef<FormModel | null>(null);
  if (modelRef.current === null) {
    modelRef.current = new FormModel();
  }
  const model = modelRef.current;

  const [requiredFields, setRequiredFields] = useState<FieldFromSchema[] | undefined>(
    undefined
  );
  const [optionalFields, setOptionalFields] = useState<FieldFromSchema[] | undefined>(
    undefined
  );
  const [optionsByField, setOptionsByField] = useState<
    Map<string, Array<{label: string; value: any}>>
  >(() => new Map());
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, GeneralSelectValue>
  >({});

  // Mirror state into refs so async callbacks (handleFieldChange, setTimeout)
  // read the latest value without needing to be recreated on every state change.
  const requiredFieldsRef = useRef(requiredFields);
  requiredFieldsRef.current = requiredFields;
  const optionalFieldsRef = useRef(optionalFields);
  optionalFieldsRef.current = optionalFields;

  const getDefaultFieldValue = useCallback(
    (field: FieldFromSchema) => {
      // Interpret the default if a getFieldDefault function is provided.
      let defaultValue = field?.defaultValue;

      // Override this default if a reset value is provided
      if (field.default && getFieldDefault) {
        defaultValue = getFieldDefault(field);
      }

      const reset = resetValues?.settings?.find(value => value.name === field.name);

      if (reset) {
        defaultValue = reset.value;
      }
      return defaultValue;
    },
    [getFieldDefault, resetValues]
  );

  const makeExternalRequest = useCallback(
    async (field: FieldFromSchema, input: FieldValue) => {
      const query: Record<string, any> = {
        ...extraRequestBody,
        uri: field.uri,
        query: input,
      };

      if (field.depends_on) {
        const dependentData = field.depends_on.reduce((accum, dependentField: string) => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          accum[dependentField] = model.getValue(dependentField);
          return accum;
        }, {});
        // stringify the data
        query.dependentData = JSON.stringify(dependentData);
      }

      const {choices, defaultValue} = await api.requestPromise(
        `/sentry-app-installations/${sentryAppInstallationUuid}/external-requests/`,
        {query}
      );

      // If there is a default choice prepopulate the select with it
      if (defaultValue) {
        model.setValue(field.name, defaultValue);
      }

      return choices || [];
    },
    [api, extraRequestBody, model, sentryAppInstallationUuid]
  );

  const debouncedOptionLoad = useMemo(
    () =>
      // debounce is used to prevent making a request for every input change and
      // instead makes the requests every 200ms
      debounce(
        async (field: FieldFromSchema, input, resolve) => {
          const choices = await makeExternalRequest(field, input);
          // @ts-expect-error TS(7031): Binding element 'value' implicitly has an 'any' ty... Remove this comment to see the full error message
          const options = choices.map(([value, label]) => ({value, label}));
          setOptionsByField(prev => {
            const next = new Map(prev);
            next.set(field.name, options);
            return next;
          });
          return resolve(options);
        },
        200,
        {trailing: true}
      ),
    [makeExternalRequest]
  );

  const getOptions = (field: FieldFromSchema, input: string) =>
    new Promise(resolve => {
      debouncedOptionLoad(field, input, resolve);
    });

  /**
   * This function determines which fields need to be reset and new options fetched
   * based on the dependencies defined with the depends_on attribute.
   * This is done because the autoload flag causes fields to load at different times
   * if you have multiple dependent fields while this solution updates state at once.
   */
  const handleFieldChange = useCallback(
    async (id: string) => {
      const currentRequired = requiredFieldsRef.current || [];
      const currentOptional = optionalFieldsRef.current || [];

      const fieldList = currentRequired.concat(currentOptional);

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
          const defaultValue = getDefaultFieldValue(field);
          model.setValue(field.name || '', defaultValue || '', {quiet: true});
          return makeExternalRequest(field, '');
        })
      );

      const applyUpdates = (
        prev: FieldFromSchema[] | undefined
      ): FieldFromSchema[] | undefined => {
        let updated = prev || [];
        // iterate through all the impacted fields and get new values
        impactedFields.forEach((impactedField, i) => {
          const index = updated.indexOf(impactedField);
          // immutably update the list only if this field lives here
          if (index > -1) {
            updated = replaceAtArrayIndex(updated, index, {
              ...impactedField,
              choices: choiceArray[i],
            });
          }
        });
        return updated;
      };

      setRequiredFields(applyUpdates);
      setOptionalFields(applyUpdates);
    },
    [getDefaultFieldValue, makeExternalRequest, model]
  );

  // reset the state when we mount or the action changes
  useEffect(() => {
    // These fields are seeded from config but mutated by handleFieldChange to
    // overwrite `choices` as dependent options load, so they can't be purely derived.
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setRequiredFields(config.required_fields);
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setOptionalFields(config.optional_fields);

    model.reset();

    // For alert-rule-actions, the forms are entirely custom, extra fields are
    // passed in on submission, not as part of the form. See handleAlertRuleSubmit().
    if (element === 'alert-rule-action') {
      const defaultResetValues = resetValues?.settings || [];
      const initialData = defaultResetValues.reduce((acc, curr) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        acc[curr.name] = curr.value;
        return acc;
      }, {});
      model.setInitialData({...initialData});
    } else {
      model.setInitialData({
        ...extraFields,
        // we need to pass these fields in the API so just set them as values so we don't need hidden form fields
        action,
        uri: config.uri,
      });
    }

    // let the state update before we try and load the dependent options
    const timer = setTimeout(() => {
      // first find every field where we don't load the values on open
      const fieldsToLoad = [
        ...(config.required_fields || []),
        ...(config.optional_fields || []),
      ].filter(
        field =>
          field.skip_load_on_open || (field.depends_on && field.depends_on.length > 0)
      );

      fieldsToLoad.forEach(field => {
        if (field.depends_on && field.depends_on.length > 0) {
          // check that we can load this field
          const isReadyToLoad = field.depends_on.every(dependentField => {
            return !!model.getValue(dependentField);
          });
          // if ready to load, trigger a field change to trigger the api request to load options
          if (isReadyToLoad) {
            handleFieldChange(field.depends_on[0]!);
          }
        }
      });
    }, 0);
    return () => clearTimeout(timer);
    // Preserve original componentDidUpdate behavior: only reset on action changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const renderField = (field: FieldFromSchema, required: boolean) => {
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
      const defaultOptions = getDefaultOptions(field, resetValues?.settings);
      const options = optionsByField.get(field.name) || defaultOptions;

      fieldToPass = {
        ...fieldToPass,
        options,
        defaultOptions,
        defaultValue: getDefaultFieldValue(field),
        // filter by what the user is typing
        filterOption: createFilter({}),
        allowClear: !required,
        placeholder: 'Type to search',
      } as Field;
      if (field.depends_on) {
        // check if this is dependent on other fields which haven't been set yet
        const shouldDisable = field.depends_on.some(
          dependentField => !hasValue(model.getValue(dependentField))
        );
        if (shouldDisable) {
          fieldToPass = {...fieldToPass, disabled: true};
        }
      }
    }
    if (['text', 'textarea'].includes(fieldToPass.type || '')) {
      fieldToPass = {
        ...fieldToPass,
        defaultValue: getDefaultFieldValue(field),
      };
    }

    // if we have a uri, we need to set extra parameters
    const extraProps = field.uri
      ? {
          loadOptions: (input: string) => getOptions(field, input),
          async: field?.async ?? true,
          cache: false,
          onSelectResetsInput: false,
          onCloseResetsInput: false,
          onBlurResetsInput: false,
          autoload: false,
          onChangeOption: (option: any, _event: any) =>
            setSelectedOptions(prev => ({...prev, [field.name]: option})),
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

  const handleAlertRuleSubmit: OnSubmitCallback = (formData, onSuccess) => {
    if (model.validateForm()) {
      onSuccess({
        // The form data must be nested in 'settings' to ensure they don't overlap with any other field names.
        settings: Object.entries(formData).map(([name, value]) => {
          const savedSetting: SentryAppSetting = {name, value};
          const stateOption = selectedOptions[name];
          // If the field is a SelectAsync, we need to preserve the label since the next time it's rendered,
          // we can't be sure the options will contain this selection
          if (stateOption?.value === value) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
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

  if (!sentryAppInstallationUuid) {
    return null;
  }

  const requiredList = requiredFields || [];
  const optionalList = optionalFields || [];

  return (
    <Form
      key={action}
      apiEndpoint={`/sentry-app-installations/${sentryAppInstallationUuid}/external-issue-actions/`}
      apiMethod="POST"
      // Without defining onSubmit, the Form will send an `apiMethod` request to the above `apiEndpoint`
      onSubmit={element === 'alert-rule-action' ? handleAlertRuleSubmit : undefined}
      onSubmitSuccess={onSubmitSuccess}
      onSubmitError={() => {
        addErrorMessage(
          t('Unable to %s %s %s.', action, appName, getElementText(element))
        );
      }}
      onFieldChange={handleFieldChange}
      preventFormResetOnUnmount
      model={model}
    >
      {requiredList.map((field: FieldFromSchema) => renderField(field, true))}
      {optionalList.map((field: FieldFromSchema) => renderField(field, false))}
    </Form>
  );
}
