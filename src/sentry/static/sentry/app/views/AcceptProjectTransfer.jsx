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
    let query = this.props.location.query;
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
        let orgSlug = formData.organization;

        this.props.router.push(`/${orgSlug}`);
        addSuccessMessage(t('Project successfully transferred'));
      },
      error: error => {
        addErrorMessage(t('Unable to transfer project.'));
      },
    });
  };

  renderBody() {
    let {transferDetails} = this.state;
    let choices = [];

    transferDetails.organizations.forEach(org => {
      choices.push([org.slug, org.slug]);
    });
    return (
      <NarrowLayout>
        <SettingsPageHeader title={t('Approve Transfer Project Request')} />
        <p>
          {tct(
            'Projects must be transferred to a specific [organization]. ' +
              'You can grant specific teams access to the project later under the [projectSettings].',
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
            choices={choices}
            label={t('Organization')}
            name={'organization'}
            style={{borderBottom: 'none'}}
          />
        </Form>
      </NarrowLayout>
    );
  }
}

export default AcceptProjectTransfer;
