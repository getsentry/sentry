import {observable, computed, action} from 'mobx';
import _ from 'lodash';

import {Client} from 'app/api';
import {addErrorMessage, saveOnBlurUndoMessage} from 'app/actionCreators/indicator';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import FormState from 'app/components/forms/state';

class FormModel {
  /**
   * Map of field name -> value
   */
  @observable fields = new Map();

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
  snapshots = [];

  /**
   * POJO of field name -> value
   * It holds field values "since last save"
   */
  initialData = {};

  constructor({initialData, ...options} = {}) {
    this.setFormOptions(options);

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
    this.api = null;
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
    return !_.isEqual(this.initialData, this.fields.toJSON());
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
  setInitialData(initialData, {noResetSnapshots} = {}) {
    this.fields.replace(initialData || {});
    this.initialData = this.fields.toJSON() || {};

    if (noResetSnapshots) return;

    this.snapshots = [new Map(this.fields)];
  }

  /**
   * Set form options
   */
  setFormOptions(options) {
    this.options = options || {};
  }

  /**
   * Set field properties
   */
  setFieldDescriptor(id, props) {
    this.fieldDescriptor.set(id, props);

    // Set default value iff initialData for field is undefined
    // This must take place before checking for `props.setValue` so that it can
    // be applied to `defaultValue`
    if (
      typeof props.defaultValue !== 'undefined' &&
      typeof this.initialData[id] === 'undefined'
    ) {
      this.initialData[id] = props.defaultValue;
      this.fields.set(id, this.initialData[id]);
    }

    if (typeof props.setValue === 'function') {
      this.initialData[id] = props.setValue(this.initialData[id], props);
      this.fields.set(id, this.initialData[id]);
    }
  }

  /**
   * Creates a cloned Map of `this.fields` and returns a closure that when called
   * will save Map to `snapshots
   */
  createSnapshot() {
    let snapshot = new Map(this.fields);
    return () => this.snapshots.unshift(snapshot);
  }

  getDescriptor(id, key) {
    // Needs to call `has` or else component will not be reactive if `id` doesn't exist in observable map
    let descriptor = this.fieldDescriptor.has(id) && this.fieldDescriptor.get(id);
    if (!descriptor) {
      return null;
    }

    return descriptor[key];
  }

  getFieldState(id, key) {
    // Needs to call `has` or else component will not be reactive if `id` doesn't exist in observable map
    let fieldState = this.fieldState.has(id) && this.fieldState.get(id);
    if (!fieldState) {
      return null;
    }

    return fieldState[key];
  }

  getValue(id) {
    if (!this.fields.has(id)) {
      return '';
    }

    return this.fields.get(id);
  }

  getTransformedValue(id) {
    let fieldDescriptor = this.fieldDescriptor.get(id);
    let transformer =
      fieldDescriptor && typeof fieldDescriptor.getValue === 'function'
        ? fieldDescriptor.getValue
        : null;
    let value = this.getValue(id);

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
    let form = this.getData();

    return Object.keys(form)
      .map(id => [id, this.getTransformedValue(id)])
      .reduce((acc, [id, value]) => {
        acc[id] = value;
        return acc;
      }, {});
  }

  getError(id) {
    return this.errors.has(id) && this.errors.get(id);
  }

  // Returns true if not required or is required and is not empty
  isValidRequiredField(id) {
    // Check field descriptor to see if field is required
    let isRequired = this.getDescriptor(id, 'required');
    return !isRequired || this.getValue(id) !== '';
  }

  isValidField(id) {
    let validate = this.getDescriptor(id, 'validate');
    let errors = [];

    if (typeof validate === 'function') {
      // Returns "tuples" of [id, error string]
      errors = validate({model: this, id, form: this.getData()}) || [];
    }

    errors
      .filter(([, errorMessage]) => !!errorMessage)
      .forEach(([field, errorMessage]) => {
        this.setError(field, errorMessage);
      });

    return !errors.length && this.isValidRequiredField(id);
  }

  doApiRequest({apiEndpoint, apiMethod, data}) {
    let endpoint = apiEndpoint || this.options.apiEndpoint;
    let method = apiMethod || this.options.apiMethod;

    return new Promise((resolve, reject) => {
      this.api.request(endpoint, {
        method,
        data,
        success: response => resolve(response),
        error: error => reject(error),
      });
    });
  }

  @action
  setValue(id, value) {
    this.fields.set(id, value);

    if (this.options.onFieldChange) {
      this.options.onFieldChange(id, value);
    }

    this.updateErrorState(id);
    this.updateShowSaveState(id, value);
    this.updateShowReturnButtonState(id, value);
  }
  @action
  updateErrorState(id) {
    let fieldIsRequiredMessage = t('Field is required');
    let isValid = this.isValidRequiredField(id);
    // specifically check for empty string, 0 should be allowed
    if (isValid && !this.errors.get(id)) return;
    if (!isValid && this.errors.get(id) === fieldIsRequiredMessage) return;

    this.setError(id, isValid ? false : fieldIsRequiredMessage);
  }

  @action
  updateShowSaveState(id, value) {
    let isValueChanged = value !== this.initialData[id];
    // Update field state to "show save" if save on blur is disabled for this field
    // (only if contents of field differs from initial value)
    let saveOnBlurFieldOverride = this.getDescriptor(id, 'saveOnBlur');
    if (typeof saveOnBlurFieldOverride === 'undefined' || saveOnBlurFieldOverride) return;
    if (this.getFieldState(id, 'showSave') === isValueChanged) return;

    this.setFieldState(id, 'showSave', isValueChanged);
  }

  @action
  updateShowReturnButtonState(id, value) {
    let isValueChanged = value !== this.initialData[id];
    let shouldShowReturnButton = this.getDescriptor(id, 'showReturnButton');

    if (!shouldShowReturnButton) return;
    // Only update state if state has changed
    if (this.getFieldState(id, 'showReturnButton') === isValueChanged) return;

    this.setFieldState(id, 'showReturnButton', isValueChanged);
  }

  /**
   * Changes form values to previous saved state
   */
  @action
  undo() {
    // Always have initial data snapshot
    if (this.snapshots.length < 2) return null;

    this.snapshots.shift();
    this.fields.replace(this.snapshots[0]);

    return true;
  }

  /**
   * Attempts to save entire form to server and saves a snapshot for undos
   */
  @action
  saveForm() {
    // Represents state of current form
    let form = this.getData();

    let errors = [
      // This only validates fields with values
      ...(Object.keys(form).filter(id => !this.isValidField(id)) || []),
      // Validate required fields
      ...(Array.from(this.fieldDescriptor.keys()).filter(id => !this.isValidField(id)) ||
        []),
    ];

    if (errors.length > 0) return null;

    let saveSnapshot = this.createSnapshot();

    let request = this.doApiRequest({
      data: this.getTransformedData(),
    });

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
      .catch((resp, ...args) => {
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
   */
  @action
  saveField(id, currentValue) {
    let oldValue = this.initialData[id];
    let savePromise = this.saveFieldRequest(id, currentValue);

    if (!savePromise) return null;

    return savePromise
      .then(resp => {
        let newValue = this.getValue(id);
        let change = {old: oldValue, new: newValue};

        // Only use `allowUndo` option if explicity defined
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
  saveFieldRequest(id, currentValue) {
    let initialValue = this.initialData[id];

    // Don't save if field hasn't changed
    // Don't need to check for error state since initialData wouldn't have updated since last error
    if (currentValue === initialValue || (currentValue === '' && !defined(initialValue)))
      return null;

    // Check for error first
    if (!this.isValidField(id)) return null;

    // shallow clone fields
    let saveSnapshot = this.createSnapshot();

    // Save field + value
    this.setSaving(id, true);

    let fieldDescriptor = this.fieldDescriptor.get(id);

    // Check if field needs to handle transforming request object
    let getData =
      typeof fieldDescriptor.getData === 'function' ? fieldDescriptor.getData : a => a;

    let request = this.doApiRequest({
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
        let shouldReset = this.getDescriptor(id, 'resetOnError');
        if (shouldReset) {
          this.setValue(id, initialValue);
        }

        // API can return a JSON object with either:
        // 1) map of {[fieldName] => Array<ErrorMessages>}
        // 2) {'non_field_errors' => Array<ErrorMessages>}
        if (resp && resp.responseJSON) {
          // Show resp msg from API endpoint if possible
          if (Array.isArray(resp.responseJSON[id]) && resp.responseJSON[id].length) {
            // Just take first resp for now
            this.setError(id, resp.responseJSON[id][0]);
          } else if (
            Array.isArray(resp.responseJSON.non_field_errors) &&
            resp.responseJSON.non_field_errors.length
          ) {
            addErrorMessage(resp.responseJSON.non_field_errors[0], 10000);
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
  handleBlurField(id, currentValue) {
    // Nothing to do if `saveOnBlur` is not on
    if (!this.options.saveOnBlur) return null;

    // Fields can individually set `saveOnBlur` to `false` (note this is ignored when `undefined`)
    let saveOnBlurFieldOverride = this.getDescriptor(id, 'saveOnBlur');
    if (typeof saveOnBlurFieldOverride !== 'undefined' && !saveOnBlurFieldOverride) {
      return null;
    }

    return this.saveField(id, currentValue);
  }

  /**
   * This is called when a field does not saveOnBlur and has an individual "Save" button
   */
  @action
  handleSaveField(id, currentValue) {
    return this.saveField(id, currentValue).then(() => {
      this.setFieldState(id, 'showSave', false);
    });
  }

  /**
   * Cancel "Save Field" state and revert form value back to initial value
   */
  @action
  handleCancelSaveField(id) {
    this.setValue(id, this.initialData[id]);
    this.setFieldState(id, 'showSave', false);
  }

  @action
  setFieldState(id, key, value) {
    let state = {
      ...(this.fieldState.get(id) || {}),
      [key]: value,
    };
    this.fieldState.set(id, state);
  }

  /**
   * Set "saving" state for field
   */
  @action
  setSaving(id, value) {
    // When saving, reset error state
    this.setError(id, false);
    this.setFieldState(id, FormState.SAVING, value);
    this.setFieldState(id, FormState.READY, !value);
  }

  /**
   * Set "error" state for field
   */
  @action
  setError(id, error) {
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

  // TODO: More validations
  @action
  validate() {}

  @action
  handleErrorResponse({responseJSON: resp} = {}) {
    if (!resp) return;

    // Show resp msg from API endpoint if possible
    Object.keys(resp).forEach(id => {
      if (
        id === 'non_field_errors' &&
        Array.isArray(resp.non_field_errors) &&
        resp.non_field_errors.length
      ) {
        addErrorMessage(resp.non_field_errors[0], 10000);
      } else if (Array.isArray(resp[id]) && resp[id].length) {
        // Just take first resp for now
        this.setError(id, resp[id][0]);
      }
    });
  }

  @action
  submitSuccess(data) {
    // update initial data
    this.formState = FormState.READY;
    this.initialData = data;
  }

  @action
  submitError(err) {
    this.formState = FormState.ERROR;
    this.formErrors = err.responseJSON;
    this.handleErrorResponse(err);
  }
}

export default FormModel;
