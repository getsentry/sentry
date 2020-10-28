import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import NarrowLayout from 'app/components/narrowLayout';
import SelectField from 'app/views/settings/components/forms/selectField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {t, tct} from 'app/locale';

class AcceptProjectTransfer extends AsyncView {
  getEndpoints() {
    const query = this.props.location.query;
    return [['transferDetails', '/accept-transfer/', {query}]];
  }

  getTitle() {
    return t('Accept Project Transfer');
  }

  handleSubmit = formData => {
    this.api.request('/accept-transfer/', {
      method: 'POST',
      data: {
        data: this.props.location.query.data,
        organization: formData.organization,
      },
      success: () => {
        const orgSlug = formData.organization;

        this.props.router.push(`/${orgSlug}`);
        addSuccessMessage(t('Project successfully transferred'));
      },
      error: error => {
        const errorMsg =
          error && error.responseJSON && typeof error.responseJSON.detail === 'string'
            ? error.responseJSON.detail
            : '';

        addErrorMessage(
          t('Unable to transfer project') + errorMsg ? `: ${errorMsg}` : ''
        );
      },
    });
  };

  renderError(error) {
    let disableLog = false;
    // Check if there is an error message with `transferDetails` endpoint
    // If so, show as toast and ignore, otherwise log to sentry
    if (error && error.responseJSON && typeof error.responseJSON.detail === 'string') {
      addErrorMessage(error.responseJSON.detail);
      disableLog = true;
    }

    super.renderError(error, disableLog);
  }

  renderBody() {
    const {transferDetails} = this.state;
    const choices = [];

    transferDetails.organizations.forEach(org => {
      choices.push([org.slug, org.slug]);
    });
    return (
      <NarrowLayout>
        <SettingsPageHeader title={t('Approve Transfer Project Request')} />
        <p>
          {tct(
            'Projects must be transferred to a specific [organization]. ' +
              'You can grant specific teams access to the project later under the [projectSettings]. ' +
              '(Note that granting access to at least one team is necessary for the project to ' +
              'appear in all parts of the UI.)',
            {
              organization: <strong>{t('Organization')}</strong>,
              projectSettings: <strong>{t('Project Settings')}</strong>,
            }
          )}
        </p>
        <p>
          {tct('Please select which [organization] you want for the project [project].', {
            organization: <strong>{t('Organization')}</strong>,
            project: transferDetails.project.slug,
          })}
        </p>
        <Form
          onSubmit={this.handleSubmit}
          submitLabel={t('Transfer Project')}
          submitPriority="danger"
          initialData={{organization: choices[0] && choices[0][0]}}
        >
          <SelectField
            deprecatedSelectControl
            choices={choices}
            label={t('Organization')}
            name="organization"
            style={{borderBottom: 'none'}}
          />
        </Form>
      </NarrowLayout>
    );
  }
}

export default AcceptProjectTransfer;
