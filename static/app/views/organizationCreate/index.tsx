import {useState} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ApiForm from 'sentry/components/forms/apiForm';
import CheckboxField from 'sentry/components/forms/fields/checkboxField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {OrganizationSummary} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

enum RegionDisplayName {
  US = '🇺🇸 United States of America (US)',
  DE = '🇪🇺 European Union (EU)',
}

function getRegionChoices(): [string, string][] {
  const regions = ConfigStore.get('regions') ?? [];

  return regions.map(({name, url}) => {
    const regionName = name.toUpperCase();
    if (RegionDisplayName[regionName]) {
      return [url, RegionDisplayName[regionName]];
    }

    return [url, name];
  });
}

function getDefaultRegionChoice(
  regionChoices: [string, string][]
): [string, string] | undefined {
  if (!shouldDisplayRegions()) {
    return undefined;
  }

  const usRegion = regionChoices.find(
    ([_, regionName]) => regionName === RegionDisplayName.US
  );

  if (usRegion) {
    return usRegion;
  }

  return regionChoices[0];
}

function shouldDisplayRegions(): boolean {
  const regionCount = (ConfigStore.get('regions') ?? []).length;
  return (
    ConfigStore.get('features').has('organizations:multi-region-selector') &&
    regionCount > 1
  );
}

function removeRegionFromRequestForm(formData: Record<string, any>) {
  const shallowFormDataCopy = {...formData};

  delete shallowFormDataCopy.region;
  return shallowFormDataCopy;
}

function OrganizationCreate() {
  const termsUrl = ConfigStore.get('termsUrl');
  const privacyUrl = ConfigStore.get('privacyUrl');
  const regionChoices = getRegionChoices();
  const [regionUrl, setRegion] = useState<string | undefined>(
    getDefaultRegionChoice(regionChoices)?.[0]
  );

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
          hostOverride={regionUrl}
          onSubmit={removeRegionFromRequestForm}
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
          {shouldDisplayRegions() && (
            <SelectField
              name="region"
              label="Data Storage"
              help="Where will this organization reside?"
              defaultValue={getDefaultRegionChoice(regionChoices)?.[0]}
              choices={regionChoices}
              onChange={setRegion}
              inline={false}
              stacked
              required
            />
          )}
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
