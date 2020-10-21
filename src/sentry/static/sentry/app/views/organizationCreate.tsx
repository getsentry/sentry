import AsyncView from 'app/views/asyncView';
import ConfigStore from 'app/stores/configStore';
import NarrowLayout from 'app/components/narrowLayout';
import {ApiForm, BooleanField, TextField} from 'app/components/forms';
import {t, tct} from 'app/locale';

export default class OrganizationCreate extends AsyncView {
  onSubmitSuccess = data => {
    // redirect to project creation *(BYPASS REACT ROUTER AND FORCE PAGE REFRESH TO GRAB CSRF TOKEN)*
    // browserHistory.pushState(null, `/organizations/${data.slug}/projects/new/`);
    window.location.href = `/organizations/${data.slug}/projects/new/`;
  };

  getEndpoints() {
    return [];
  }

  getTitle() {
    return t('Create Organization');
  }

  renderBody() {
    const termsUrl = ConfigStore.get('termsUrl');
    const privacyUrl = ConfigStore.get('privacyUrl');

    return (
      <NarrowLayout showLogout>
        <h3>{t('Create a New Organization')}</h3>

        <p>
          {t(
            "Organizations represent the top level in your hierarchy. You'll be able to bundle a collection of teams within an organization as well as give organization-wide permissions to users."
          )}
        </p>

        <ApiForm
          initialData={{defaultTeam: true}}
          submitLabel={t('Create Organization')}
          apiEndpoint="/organizations/"
          apiMethod="POST"
          onSubmitSuccess={this.onSubmitSuccess}
          requireChanges
        >
          <TextField
            name="name"
            label={t('Organization Name')}
            placeholder={t('e.g. My Company')}
            required
          />

          {termsUrl && privacyUrl && (
            <BooleanField
              name="agreeTerms"
              label={tct(
                'I agree to the [termsLink:Terms of Service] and the [privacyLink:Privacy Policy]',
                {
                  termsLink: <a href={termsUrl} />,
                  privacyLink: <a href={privacyUrl} />,
                }
              )}
              required
            />
          )}
        </ApiForm>
      </NarrowLayout>
    );
  }
}
