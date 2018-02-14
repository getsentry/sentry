import {observable, computed, action} from 'mobx';
import _ from 'lodash';

import {Client} from '../../../../api';
import {defined} from '../../../../utils';
import FormState from '../../../../components/forms/state';
import {addErrorMessage} from '../../../../actionCreators/indicator';

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
    this.fields.clear();
    this.errors.clear();
    this.fieldState.clear();
    this.snapshots = [];
    this.initialData = {};
    this.fieldDescriptor.clear();
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
    if (typeof props.setValue === 'function') {
      this.initialData[id] = props.setValue(this.initialData[id]);
      this.setValue(id, this.initialData[id]);
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
      errors = validate({model: this, id, form: this.getData().toJSON()}) || [];
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

    // specifically check for empty string, 0 should be allowed
    if (!this.isValidRequiredField(id)) {
      this.setError(id, 'Field is required');
    } else {
      this.setError(id, false);
    }
  }

  @action
  undo() {
    // Always have initial data snapshot
    if (this.snapshots.length < 2) return null;

    this.snapshots.shift();
    this.fields.replace(this.snapshots[0]);

    return true;
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
  saveField(id, currentValue) {
    // Don't save if field hasn't changed
    // Don't need to check for error state since initialData wouldn't have updated since last error
    if (
      currentValue === this.initialData[id] ||
      (currentValue === '' && !defined(this.initialData[id]))
    )
      return null;

    // Check for error first
    if (!this.isValidField(id)) return null;

    // shallow clone fields
    let saveSnapshot = this.createSnapshot();
    let newValue = this.getValue(id);

    // Save field + value
    this.setSaving(id, true);

    let fieldDescriptor = this.fieldDescriptor.get(id);

    // Check if field needs to handle
    let getData =
      typeof fieldDescriptor.getData === 'function' ? fieldDescriptor.getData : a => a;

    // Transform data before saving, this uses `getValue` defined when declaring the form
    let serializer =
      typeof fieldDescriptor.getValue === 'function' ? fieldDescriptor.getValue : a => a;

    let request = this.doApiRequest({
      data: getData(
        {[id]: serializer(newValue)},
        {model: this, id, form: this.getData().toJSON()}
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

        return data;
      })
      .catch(resp => {
        // should we revert field value to last known state?
        saveSnapshot = null;

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
  handleFieldBlur(id, currentValue) {
    // Nothing to do if `saveOnBlur` is not on
    if (!this.options.saveOnBlur) return null;

    let oldValue = this.initialData[id];
    let savePromise = this.saveField(id, currentValue);

    if (!savePromise) return null;

    return savePromise
      .then(change => {
        let newValue = this.getValue(id);
        this.initialData[id] = newValue;
        let result = {old: oldValue, new: newValue};

        if (this.options.onSubmitSuccess) {
          this.options.onSubmitSuccess(result, this, id);
        }

        return result;
      })
      .catch(error => {
        if (this.options.onSubmitError) {
          this.options.onSubmitError(error, this, id);
        }
        return {};
      });
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

  @action
  getData() {
    return this.fields;
  }

  // TODO: More validations
  @action
  validate() {}

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
  }
}

export default FormModel;
