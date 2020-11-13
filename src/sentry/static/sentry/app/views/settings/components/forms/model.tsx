import {observable, computed, action, ObservableMap} from 'mobx';
import isEqual from 'lodash/isEqual';

import {Client, APIRequestMethod} from 'app/api';
import {addErrorMessage, saveOnBlurUndoMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import FormState from 'app/components/forms/state';

type Snapshot = Map<string, FieldValue>;
type SaveSnapshot = (() => number) | null;

export type FieldValue = string | number | boolean | undefined; //is undefined valid here?

export type FormOptions = {
  apiEndpoint?: string;
  apiMethod?: APIRequestMethod;
  allowUndo?: boolean;
  resetOnError?: boolean;
  saveOnBlur?: boolean;
  onFieldChange?: (id: string, finalValue: FieldValue) => void;
  onSubmitSuccess?: (
    response: any,
    instance: FormModel,
    id?: string,
    change?: {old: FieldValue; new: FieldValue}
  ) => void;
  onSubmitError?: (error: any, instance: FormModel, id?: string) => void;
};

type OptionsWithInitial = FormOptions & {initialData?: object};

class FormModel {
  /**
   * Map of field name -> value
   */
  fields: ObservableMap<string, FieldValue> = observable.map();

  /**
   * Errors for individual fields
   * Note we don't keep error in `this.fieldState` so that we can easily
   * See if the form is in an "error" state with the `isError` getter
   */
  @observable errors = new Map();

  /**
   * State of individual fields
   *
   * Map of field name -> object
   */
  @observable fieldState = new Map();

  /**
   * State of the form as a whole
   */
  @observable formState;

  /**
   * Holds field properties as declared in <Form>
   * Does not need to be observable since these props should never change
   */
  fieldDescriptor = new Map();

  /**
   * Holds a list of `fields` states
   */
  snapshots: Array<Snapshot> = [];

  /**
   * POJO of field name -> value
   * It holds field values "since last save"
   */
  initialData = {};

  api: Client;

  formErrors: any;

  options: FormOptions;

  constructor({initialData, ...options}: OptionsWithInitial = {}) {
    this.options = options || {};
    if (initialData) {
      this.setInitialData(initialData);
    }

    this.api = new Client();
  }

  /**
   * Reset state of model
   */
  reset() {
    this.api.clear();
    this.fieldDescriptor.clear();
    this.resetForm();
  }

  resetForm() {
    this.fields.clear();
    this.errors.clear();
    this.fieldState.clear();
    this.snapshots = [];
    this.initialData = {};
  }

  /**
   * Deep equality comparison between last saved state and current fields state
   */
  @computed
  get formChanged() {
    return !isEqual(this.initialData, this.fields.toJSON());
  }

  @computed
  get formData() {
    return this.fields;
  }

  /** Is form saving */
  @computed
  get isSaving() {
    return this.formState === FormState.SAVING;
  }

  /** Does form have any errors */
  @computed
  get isError() {
    return !!this.errors.size;
  }

  /**
   * Sets initial form data
   *
   * Also resets snapshots
   */
  setInitialData(initialData?: object) {
    this.fields.replace(initialData || {});
    this.initialData = this.fields.toJSON() || {};

    this.snapshots = [new Map(this.fields.entries())];
  }

  /**
   * Set form options
   */
  setFormOptions(options: FormOptions) {
    this.options = options || {};
  }

  /**
   * Set field properties
   */
  setFieldDescriptor(id: string, props) {
    //TODO(TS): add type to props
    this.fieldDescriptor.set(id, props);

    // Set default value iff initialData for field is undefined
    // This must take place before checking for `props.setValue` so that it can
    // be applied to `defaultValue`
    if (
      typeof props.defaultValue !== 'undefined' &&
      typeof this.initialData[id] === 'undefined'
    ) {
      this.initialData[id] =
        typeof props.defaultValue === 'function'
          ? props.defaultValue()
          : props.defaultValue;

      this.fields.set(id, this.initialData[id]);
    }

    if (typeof props.setValue === 'function') {
      this.initialData[id] = props.setValue(this.initialData[id], props);
      this.fields.set(id, this.initialData[id]);
    }
  }

  /**
   * Remove a field from the descriptor map and errors.
   */
  removeField(id: string) {
    this.fieldDescriptor.delete(id);
    this.errors.delete(id);
  }

  /**
   * Creates a cloned Map of `this.fields` and returns a closure that when called
   * will save Map to `snapshots
   */
  createSnapshot() {
    const snapshot = new Map(this.fields.entries());
    return () => this.snapshots.unshift(snapshot);
  }

  getDescriptor(id: string, key: string) {
    // Needs to call `has` or else component will not be reactive if `id` doesn't exist in observable map
    const descriptor = this.fieldDescriptor.has(id) && this.fieldDescriptor.get(id);
    if (!descriptor) {
      return null;
    }

    return descriptor[key];
  }

  getFieldState(id: string, key: string) {
    // Needs to call `has` or else component will not be reactive if `id` doesn't exist in observable map
    const fieldState = this.fieldState.has(id) && this.fieldState.get(id);
    if (!fieldState) {
      return null;
    }

    return fieldState[key];
  }

  getValue(id: string) {
    if (!this.fields.has(id)) {
      return '';
    }

    return this.fields.get(id);
  }

  getTransformedValue(id: string) {
    const fieldDescriptor = this.fieldDescriptor.get(id);
    const transformer =
      fieldDescriptor && typeof fieldDescriptor.getValue === 'function'
        ? fieldDescriptor.getValue
        : null;
    const value = this.getValue(id);

    return transformer ? transformer(value) : value;
  }

  /**
   * Data represented in UI
   */
  getData() {
    return this.fields.toJSON();
  }

  /**
   * Form data that will be sent to API endpoint (i.e. after transforms)
   */
  getTransformedData() {
    const form = this.getData();

    return Object.keys(form)
      .map(id => [id, this.getTransformedValue(id)])
      .reduce((acc, [id, value]) => {
        acc[id] = value;
        return acc;
      }, {});
  }

  getError(id: string) {
    return this.errors.has(id) && this.errors.get(id);
  }

  // Returns true if not required or is required and is not empty
  isValidRequiredField(id: string) {
    // Check field descriptor to see if field is required
    const isRequired = this.getDescriptor(id, 'required');
    const value = this.getValue(id);
    return !isRequired || (value !== '' && defined(value));
  }

  isValidField(id: string) {
    return (this.getError(id) || []).length === 0;
  }

  doApiRequest({
    apiEndpoint,
    apiMethod,
    data,
  }: {
    apiEndpoint?: string;
    apiMethod?: APIRequestMethod;
    data: object;
  }) {
    const endpoint = apiEndpoint || this.options.apiEndpoint || '';
    const method = apiMethod || this.options.apiMethod;

    return new Promise((resolve, reject) =>
      this.api.request(endpoint, {
        method,
        data,
        success: response => resolve(response),
        error: error => reject(error),
      })
    );
  }

  /**
   * Set the value of the form field
   * if quiet is true, we skip callbacks, validations
   */
  @action
  setValue(id: string, value: FieldValue, {quiet}: {quiet?: boolean} = {}) {
    const fieldDescriptor = this.fieldDescriptor.get(id);
    let finalValue = value;

    if (fieldDescriptor && typeof fieldDescriptor.transformInput === 'function') {
      finalValue = fieldDescriptor.transformInput(value);
    }

    this.fields.set(id, finalValue);
    if (quiet) {
      return;
    }

    if (this.options.onFieldChange) {
      this.options.onFieldChange(id, finalValue);
    }

    this.validateField(id);
    this.updateShowSaveState(id, finalValue);
    this.updateShowReturnButtonState(id, finalValue);
  }

  @action
  validateField(id: string) {
    const validate = this.getDescriptor(id, 'validate');
    let errors: any[] = [];

    if (typeof validate === 'function') {
      // Returns "tuples" of [id, error string]
      errors = validate({model: this, id, form: this.getData()}) || [];
    }

    const fieldIsRequiredMessage = t('Field is required');

    if (!this.isValidRequiredField(id)) {
      errors.push([id, fieldIsRequiredMessage]);
    }

    // If we have no errors, ensure we clear the field
    errors = errors.length === 0 ? [[id, null]] : errors;

    errors.forEach(([field, errorMessage]) => this.setError(field, errorMessage));
    return undefined;
  }

  @action
  updateShowSaveState(id: string, value: FieldValue) {
    const isValueChanged = value !== this.initialData[id];
    // Update field state to "show save" if save on blur is disabled for this field
    // (only if contents of field differs from initial value)
    const saveOnBlurFieldOverride = this.getDescriptor(id, 'saveOnBlur');
    if (typeof saveOnBlurFieldOverride === 'undefined' || saveOnBlurFieldOverride) {
      return;
    }
    if (this.getFieldState(id, 'showSave') === isValueChanged) {
      return;
    }

    this.setFieldState(id, 'showSave', isValueChanged);
  }

  @action
  updateShowReturnButtonState(id: string, value: FieldValue) {
    const isValueChanged = value !== this.initialData[id];
    const shouldShowReturnButton = this.getDescriptor(id, 'showReturnButton');

    if (!shouldShowReturnButton) {
      return;
    }
    // Only update state if state has changed
    if (this.getFieldState(id, 'showReturnButton') === isValueChanged) {
      return;
    }

    this.setFieldState(id, 'showReturnButton', isValueChanged);
  }

  /**
   * Changes form values to previous saved state
   */
  @action
  undo() {
    // Always have initial data snapshot
    if (this.snapshots.length < 2) {
      return null;
    }

    this.snapshots.shift();
    this.fields.replace(this.snapshots[0]);

    return true;
  }

  /**
   * Attempts to save entire form to server and saves a snapshot for undos
   */
  @action
  saveForm() {
    if (!this.validateForm()) {
      return null;
    }

    let saveSnapshot: SaveSnapshot = this.createSnapshot();

    const request = this.doApiRequest({
      data: this.getTransformedData(),
    });

    this.setFormSaving();
    request
      .then(resp => {
        // save snapshot
        if (saveSnapshot) {
          saveSnapshot();
          saveSnapshot = null;
        }

        if (this.options.onSubmitSuccess) {
          this.options.onSubmitSuccess(resp, this);
        }
      })
      .catch(resp => {
        // should we revert field value to last known state?
        saveSnapshot = null;
        if (this.options.resetOnError) {
          this.setInitialData({});
        }
        this.submitError(resp);
        if (this.options.onSubmitError) {
          this.options.onSubmitError(resp, this);
        }
      });

    return request;
  }

  /**
   * Attempts to save field and show undo message if necessary.
   * Calls submit handlers.
   * TODO(billy): This should return a promise that resolves (instead of null)
   */
  @action
  saveField(id: string, currentValue: FieldValue) {
    const oldValue = this.initialData[id];
    const savePromise = this.saveFieldRequest(id, currentValue);

    if (!savePromise) {
      return null;
    }

    return savePromise
      .then(resp => {
        const newValue = this.getValue(id);
        const change = {old: oldValue, new: newValue};

        // Only use `allowUndo` option if explicitly defined
        if (typeof this.options.allowUndo === 'undefined' || this.options.allowUndo) {
          saveOnBlurUndoMessage(change, this, id);
        }

        if (this.options.onSubmitSuccess) {
          this.options.onSubmitSuccess(resp, this, id, change);
        }

        return resp;
      })
      .catch(error => {
        if (this.options.onSubmitError) {
          this.options.onSubmitError(error, this, id);
        }
        return {};
      });
  }

  /**
   * Saves a field with new value
   *
   * If field has changes, field does not have errors, then it will:
   * Save a snapshot, apply any data transforms, perform api request.
   *
   * If successful then: 1) reset save state, 2) update `initialData`, 3) save snapshot
   * If failed then: 1) reset save state, 2) add error state
   */
  @action
  saveFieldRequest(id: string, currentValue: FieldValue) {
    const initialValue = this.initialData[id];

    // Don't save if field hasn't changed
    // Don't need to check for error state since initialData wouldn't have updated since last error
    if (
      currentValue === initialValue ||
      (currentValue === '' && !defined(initialValue))
    ) {
      return null;
    }

    // Check for error first
    this.validateField(id);
    if (!this.isValidField(id)) {
      return null;
    }

    // shallow clone fields
    let saveSnapshot: SaveSnapshot = this.createSnapshot();

    // Save field + value
    this.setSaving(id, true);

    const fieldDescriptor = this.fieldDescriptor.get(id);

    // Check if field needs to handle transforming request object
    const getData =
      typeof fieldDescriptor.getData === 'function' ? fieldDescriptor.getData : a => a;

    const request = this.doApiRequest({
      data: getData(
        {[id]: this.getTransformedValue(id)},
        {model: this, id, form: this.getData()}
      ),
    });

    request
      .then(data => {
        this.setSaving(id, false);

        // save snapshot
        if (saveSnapshot) {
          saveSnapshot();
          saveSnapshot = null;
        }

        // Update initialData after successfully saving a field as it will now be the baseline value
        this.initialData[id] = this.getValue(id);

        return data;
      })
      .catch(resp => {
        // should we revert field value to last known state?
        saveSnapshot = null;

        // Field can be configured to reset on error
        // e.g. BooleanFields
        const shouldReset = this.getDescriptor(id, 'resetOnError');
        if (shouldReset) {
          this.setValue(id, initialValue);
        }

        // API can return a JSON object with either:
        // 1) map of {[fieldName] => Array<ErrorMessages>}
        // 2) {'non_field_errors' => Array<ErrorMessages>}
        if (resp && resp.responseJSON) {
          //non-field errors can be camelcase or snake case
          const nonFieldErrors =
            resp.responseJSON.non_field_errors || resp.responseJSON.nonFieldErrors;

          // Show resp msg from API endpoint if possible
          if (Array.isArray(resp.responseJSON[id]) && resp.responseJSON[id].length) {
            // Just take first resp for now
            this.setError(id, resp.responseJSON[id][0]);
          } else if (Array.isArray(nonFieldErrors) && nonFieldErrors.length) {
            addErrorMessage(nonFieldErrors[0], {duration: 10000});
            // Reset saving state
            this.setError(id, '');
          } else {
            this.setError(id, 'Failed to save');
          }
        } else {
          // Default error behavior
          this.setError(id, 'Failed to save');
        }

        // eslint-disable-next-line no-console
        console.error('Error saving form field', resp && resp.responseJSON);
      });

    return request;
  }

  /**
   * This is called when a field is blurred
   *
   * If `saveOnBlur` is set then call `saveField` and handle form callbacks accordingly
   */
  @action
  handleBlurField(id: string, currentValue: FieldValue) {
    // Nothing to do if `saveOnBlur` is not on
    if (!this.options.saveOnBlur) {
      return null;
    }

    // Fields can individually set `saveOnBlur` to `false` (note this is ignored when `undefined`)
    const saveOnBlurFieldOverride = this.getDescriptor(id, 'saveOnBlur');
    if (typeof saveOnBlurFieldOverride !== 'undefined' && !saveOnBlurFieldOverride) {
      return null;
    }

    return this.saveField(id, currentValue);
  }

  @action
  setFormSaving() {
    this.formState = FormState.SAVING;
  }

  /**
   * This is called when a field does not saveOnBlur and has an individual "Save" button
   */
  @action
  handleSaveField(id: string, currentValue: FieldValue) {
    const savePromise = this.saveField(id, currentValue);

    if (!savePromise) {
      return null;
    }

    return savePromise.then(() => {
      this.setFieldState(id, 'showSave', false);
    });
  }

  /**
   * Cancel "Save Field" state and revert form value back to initial value
   */
  @action
  handleCancelSaveField(id: string) {
    this.setValue(id, this.initialData[id]);
    this.setFieldState(id, 'showSave', false);
  }

  @action
  setFieldState(id: string, key: string, value: FieldValue) {
    const state = {
      ...(this.fieldState.get(id) || {}),
      [key]: value,
    };
    this.fieldState.set(id, state);
  }

  /**
   * Set "saving" state for field
   */
  @action
  setSaving(id: string, value: FieldValue) {
    // When saving, reset error state
    this.setError(id, false);
    this.setFieldState(id, FormState.SAVING, value);
    this.setFieldState(id, FormState.READY, !value);
  }

  /**
   * Set "error" state for field
   */
  @action
  setError(id: string, error: boolean | string) {
    // Note we don't keep error in `this.fieldState` so that we can easily
    // See if the form is in an "error" state with the `isError` getter
    if (!!error) {
      this.formState = FormState.ERROR;
      this.errors.set(id, error);
    } else {
      this.formState = FormState.READY;
      this.errors.delete(id);
    }

    // Field should no longer to "saving", but is not necessarily "ready"
    this.setFieldState(id, FormState.SAVING, false);
  }

  /**
   * Returns true if there are no errors
   */
  @action
  validateForm(): boolean {
    Array.from(this.fieldDescriptor.keys()).forEach(id => !this.validateField(id));

    return !this.isError;
  }

  @action
  handleErrorResponse({responseJSON: resp}: {responseJSON?: any} = {}) {
    if (!resp) {
      return;
    }

    // Show resp msg from API endpoint if possible
    Object.keys(resp).forEach(id => {
      //non-field errors can be camelcase or snake case
      const nonFieldErrors = resp.non_field_errors || resp.nonFieldErrors;
      if (
        (id === 'non_field_errors' || id === 'nonFieldErrors') &&
        Array.isArray(nonFieldErrors) &&
        nonFieldErrors.length
      ) {
        addErrorMessage(nonFieldErrors[0], {duration: 10000});
      } else if (Array.isArray(resp[id]) && resp[id].length) {
        // Just take first resp for now
        this.setError(id, resp[id][0]);
      }
    });
  }

  @action
  submitSuccess(data: object) {
    // update initial data
    this.formState = FormState.READY;
    this.initialData = data;
  }

  @action
  submitError(err: {responseJSON?: any}) {
    this.formState = FormState.ERROR;
    this.formErrors = this.mapFormErrors(err.responseJSON);
    this.handleErrorResponse({responseJSON: this.formErrors});
  }

  mapFormErrors(responseJSON?: any) {
    return responseJSON;
  }
}

export default FormModel;
