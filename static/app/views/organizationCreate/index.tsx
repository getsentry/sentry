import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ApiForm, CheckboxField, TextField} from 'sentry/components/forms';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {OrganizationSummary} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

function OrganizationCreate() {
  const termsUrl = ConfigStore.get('termsUrl');
  const privacyUrl = ConfigStore.get('privacyUrl');

  return (
    <SentryDocumentTitle title={t('Create Organization')}>
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
          onSubmitSuccess={(createdOrg: OrganizationSummary) => {
            const hasCustomerDomain = createdOrg?.features.includes('customer-domains');
            let nextUrl = normalizeUrl(
              `/organizations/${createdOrg.slug}/projects/new/`,
              {forceCustomerDomain: hasCustomerDomain}
            );
            if (hasCustomerDomain) {
              nextUrl = `${createdOrg.links.organizationUrl}${nextUrl}`;
            }
            // redirect to project creation *(BYPASS REACT ROUTER AND FORCE PAGE REFRESH TO GRAB CSRF TOKEN)*
            // browserHistory.pushState(null, `/organizations/${data.slug}/projects/new/`);
            window.location.assign(nextUrl);
          }}
          onSubmitError={error => {
            addErrorMessage(
              error.responseJSON?.detail ?? t('Unable to create organization.')
            );
          }}
          requireChanges
        >
          <TextField
            id="organization-name"
            name="name"
            label={t('Organization Name')}
            placeholder={t('e.g. My Company')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          />

          {termsUrl && privacyUrl && (
            <CheckboxField
              name="agreeTerms"
              label={tct(
                'I agree to the [termsLink:Terms of Service] and the [privacyLink:Privacy Policy]',
                {
                  termsLink: <a href={termsUrl} />,
                  privacyLink: <a href={privacyUrl} />,
                }
              )}
              inline={false}
              stacked
              required
            />
          )}
        </ApiForm>
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

export default OrganizationCreate;
