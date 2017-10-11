import PropTypes from 'prop-types';
import React from 'react';

import {extractMultilineFields} from '../../../../utils';
import {t} from '../../../../locale';
import ApiMixin from '../../../../mixins/apiMixin';
import BooleanField from '../../../../components/forms/booleanField';
import FormState from '../../../../components/forms/state';
import IndicatorStore from '../../../../stores/indicatorStore';
import Select2Field from '../../../../components/forms/select2Field';
import TextField from '../../../../components/forms/textField';
import TextareaField from '../../../../components/forms/textareaField';

const OldOrganizationSettingsForm = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    access: PropTypes.object.isRequired,
    initialData: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      formData: this.buildFormData(this.props.initialData),
      errors: {},
      hasChanges: false,
    };
  },

  buildFormData(data) {
    let result = {
      name: data.name,
      slug: data.slug,
      openMembership: data.openMembership,
      allowSharedIssues: data.allowSharedIssues,
      isEarlyAdopter: data.isEarlyAdopter,
      enhancedPrivacy: data.enhancedPrivacy,
      dataScrubber: data.dataScrubber,
      dataScrubberDefaults: data.dataScrubberDefaults,
      scrubIPAddresses: data.scrubIPAddresses,
      safeFields: data.safeFields.join('\n'),
      sensitiveFields: data.sensitiveFields.join('\n'),
    };
    if (this.props.access.has('org:admin')) {
      result.defaultRole = data.defaultRole;
    }
    return result;
  },

  onFieldChange(name, value) {
    let formData = {
      ...this.state.formData,
      [name]: value,
    };
    this.setState({
      hasChanges: true,
      formData,
    });
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state == FormState.SAVING) {
      return;
    }

    this.setState(
      {
        state: FormState.SAVING,
        hasChanges: false,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        let {orgId} = this.props;
        let formData = this.state.formData;
        this.api.request(`/organizations/${orgId}/`, {
          method: 'PUT',
          data: {
            ...formData,
            safeFields: extractMultilineFields(formData.safeFields),
            sensitiveFields: extractMultilineFields(formData.sensitiveFields),
          },
          success: data => {
            this.props.onSave(data);
            this.setState({
              state: FormState.READY,
              errors: {},
            });
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(t('Changes saved.'), 'success', {
              duration: 1500,
            });
          },
          error: error => {
            this.setState({
              state: FormState.ERROR,
              errors: error.responseJSON,
            });
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error', {
              duration: 3000,
            });
          },
        });
      }
    );
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let {errors, formData} = this.state;
    let {access, initialData} = this.props;

    let sensitiveFieldsHelp = (
      <span>
        {t(
          'Additional field names to match against when scrubbing data for all projects. Separate multiple entries with a newline.'
        )}
        <br />
        <strong>
          {t('Note: These fields will be used in addition to project specific fields.')}
        </strong>
      </span>
    );

    let safeFieldsHelp = (
      <span>
        {t(
          'Field names which data scrubbers should ignore. Separate multiple entries with a newline.'
        )}
        <br />
        <strong>
          {t('Note: These fields will be used in addition to project specific fields.')}
        </strong>
      </span>
    );

    return (
      <div className="box">
        <div className="box-content with-padding">
          <form
            onSubmit={this.onSubmit}
            className="form-stacked ref-organization-settings"
          >
            {this.state.state === FormState.ERROR && (
              <div className="alert alert-error alert-block">
                {t(
                  'Unable to save your changes. Please ensure all fields are valid and try again.'
                )}
              </div>
            )}
            <fieldset>
              <legend style={{marginTop: 0}}>{t('General')}</legend>

              <TextField
                key="name"
                name="name"
                label={t('Name')}
                help={t('The name of your organization. i.e. My Company')}
                value={formData.name}
                required={true}
                error={errors.name}
                onChange={this.onFieldChange.bind(this, 'name')}
              />
              <TextField
                key="slug"
                name="slug"
                label={t('Short name')}
                value={formData.slug}
                help={t('A unique ID used to identify this organization.')}
                required={true}
                error={errors.slug}
                onChange={this.onFieldChange.bind(this, 'slug')}
              />
              <BooleanField
                key="isEarlyAdopter"
                name="isEarlyAdopter"
                label={t('Early Adopter')}
                value={formData.isEarlyAdopter}
                help={t("Opt-in to new features before they're released to the public.")}
                required={false}
                error={errors.isEarlyAdopter}
                onChange={this.onFieldChange.bind(this, 'isEarlyAdopter')}
              />

              <legend>{t('Membership')}</legend>

              {access.has('org:admin') && (
                <Select2Field
                  key="defaultRole"
                  name="defaultRole"
                  label={t('Default Role')}
                  choices={initialData.availableRoles.map(r => [r.id, r.name])}
                  value={formData.defaultRole}
                  help={t('The default role new members will receive.')}
                  required={true}
                  error={errors.defaultRole}
                  onChange={this.onFieldChange.bind(this, 'defaultRole')}
                />
              )}

              <BooleanField
                key="openMembership"
                name="openMembership"
                label={t('Open Membership')}
                value={formData.openMembership}
                help={t('Allow organization members to freely join or leave any team.')}
                required={true}
                error={errors.openMembership}
                onChange={this.onFieldChange.bind(this, 'openMembership')}
              />

              <legend>{t('Security & Privacy')}</legend>

              <BooleanField
                key="allowSharedIssues"
                name="allowSharedIssues"
                label={t('Allow Shared Issues')}
                value={formData.allowSharedIssues}
                help={t(
                  'Enable sharing of limited details on issues to anonymous users.'
                )}
                required={false}
                error={errors.allowSharedIssues}
                onChange={this.onFieldChange.bind(this, 'allowSharedIssues')}
              />

              <BooleanField
                key="enhancedPrivacy"
                name="enhancedPrivacy"
                label={t('Enhanced Privacy')}
                value={formData.enhancedPrivacy}
                help={t(
                  'Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.'
                )}
                required={false}
                error={errors.enhancedPrivacy}
                onChange={this.onFieldChange.bind(this, 'enhancedPrivacy')}
              />

              <BooleanField
                key="dataScrubber"
                name="dataScrubber"
                label={t('Require Data Scrubber')}
                value={formData.dataScrubber}
                help={t(
                  'Require server-side data scrubbing be enabled for all projects.'
                )}
                required={false}
                error={errors.dataScrubber}
                onChange={this.onFieldChange.bind(this, 'dataScrubber')}
              />

              <BooleanField
                key="dataScrubberDefaults"
                name="dataScrubberDefaults"
                label={t('Require Using Default Scrubbers')}
                value={formData.dataScrubberDefaults}
                help={t(
                  'Require the default scrubbers be applied to prevent things like passwords and credit cards from being stored for all projects.'
                )}
                required={true}
                error={errors.dataScrubberDefaults}
                onChange={this.onFieldChange.bind(this, 'dataScrubberDefaults')}
              />

              <TextareaField
                key="sensitiveFields"
                name="sensitiveFields"
                label={t('Global sensitive fields')}
                value={formData.sensitiveFields}
                help={sensitiveFieldsHelp}
                placeholder={t('e.g. email')}
                required={false}
                error={errors.sensitiveFields}
                onChange={this.onFieldChange.bind(this, 'sensitiveFields')}
              />

              <TextareaField
                key="safeFields"
                name="safeFields"
                label={t('Global safe fields')}
                value={formData.safeFields}
                help={safeFieldsHelp}
                placeholder={t('e.g. email')}
                required={false}
                error={errors.safeFields}
                onChange={this.onFieldChange.bind(this, 'safeFields')}
              />

              <BooleanField
                key="scrubIPAddresses"
                name="scrubIPAddresses"
                label={t('Prevent Storing of IP Addresses')}
                value={formData.scrubIPAddresses}
                help={t(
                  'Preventing IP addresses from being stored for new events on all projects.'
                )}
                required={false}
                error={errors.scrubIPAddresses}
                onChange={this.onFieldChange.bind(this, 'scrubIPAddresses')}
              />
            </fieldset>
            <fieldset className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving || !this.state.hasChanges}
              >
                {t('Save Changes')}
              </button>
            </fieldset>
          </form>
        </div>
      </div>
    );
  },
});

export default OldOrganizationSettingsForm;
