import React from 'react';

import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import IndicatorStore from 'app/stores/indicatorStore';
import NarrowLayout from 'app/components/narrowLayout';
import SelectField from 'app/views/settings/components/forms/selectField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {t, tct} from 'app/locale';

class IntegrationInstallation extends AsyncView {
  componentDidMount() {
    this.dialog = null;
    window.addEventListener('message', this.receiveMessage, false);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.receiveMessage);

    if (this.dialog !== null) {
      this.dialog.close();
    }
  }

  getEndpoints() {
    return [['organizations', '/integration-installation/']];
  }

  getTitle() {
    return t('Choose Installation Organization');
  }

  handleSubmit = formData => {
    const name = 'sentryAddIntegration';
    const installationId = this.props.location.pathname.replace(/[\/\integration]/g, '');
    const orgSlug = formData.organization;
    this.dialog = window.open(
      `/organizations/${orgSlug}/integrations/github/setup/?installation_id=${installationId}`,
      name,
      `scrollbars=yes,width=${1000},height=${1000},top=${100},left=${100}`
    );

    this.dialog.focus();
  };

  receiveMessage = message => {
    if (message.origin !== document.origin) {
      return;
    }

    if (message.source !== this.dialog) {
      return;
    }

    this.dialog = null;

    const {success, data} = message.data;

    if (!success) {
      IndicatorStore.addError(data.error);
      return;
    }

    this.props.router.push(`/settings/sentry/integrations/${data.provider.key}/`);
    IndicatorStore.addSuccess(t('Integration Added'));
  };

  renderBody() {
    let {organizations} = this.state;
    let choices = [];

    organizations.organizations.forEach(org => {
      choices.push([org.slug, org.slug]);
    });
    return (
      <NarrowLayout>
        <SettingsPageHeader title={t('Choose Organization for your Integration')} />
        <p>
          {tct(
            'Please pick a specific [organization] to link with your installation ' +
              'You can setup further configuration in your [organizationSettings].',
            {
              organization: <strong>{t('Organization')}</strong>,
              organizationSettings: <strong>{t('Organization Settings')}</strong>,
            }
          )}
        </p>
        <p>
          {tct('Please select which [organization] you want for the installation.', {
            organization: <strong>{t('Organization')}</strong>,
          })}
        </p>
        <Form
          onSubmit={this.handleSubmit}
          submitLabel={t('Submit')}
          submitPriority="primary"
          initialData={{organization: choices[0] && choices[0][0]}}
        >
          <SelectField
            choices={choices}
            label={t('Organization')}
            name={'organization'}
          />
        </Form>
      </NarrowLayout>
    );
  }
}

export default IntegrationInstallation;
