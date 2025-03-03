import {useCallback} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import CheckboxField from 'sentry/components/forms/fields/checkboxField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {getRegionChoices, shouldDisplayRegions} from 'sentry/utils/regions';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';

export const DATA_STORAGE_DOCS_LINK =
  'https://docs.sentry.io/product/accounts/choose-your-data-center';

function removeDataStorageLocationFromFormData(
  formData: Record<string, any>
): Record<string, any> {
  const shallowFormDataClone = {...formData};
  delete shallowFormDataClone.dataStorageLocation;
  return shallowFormDataClone;
}

const DataConsentCheck = HookOrDefault({
  hookName: 'component:data-consent-org-creation-checkbox',
  defaultComponent: null,
});

function OrganizationCreate() {
  const termsUrl = ConfigStore.get('termsUrl');
  const privacyUrl = ConfigStore.get('privacyUrl');
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const relocationUrl = normalizeUrl(`/relocation/`);
  const regionChoices = getRegionChoices();
  const client = useApi();

  const hasDataConsent =
    HookStore.get('component:data-consent-org-creation-checkbox').length !== 0;

  // This is a trimmed down version of the logic in ApiForm. It validates the
  // form data prior to submitting the request, and overrides the request host
  // with the selected region's URL if one is provided.
  const submitOrganizationCreate: OnSubmitCallback = useCallback(
    (data, onSubmitSuccess, onSubmitError, _event, formModel) => {
      if (!formModel.validateForm()) {
        return;
      }
      const regionUrl = data.dataStorageLocation;

      addLoadingMessage(t('Creating Organization\u2026'));
      formModel.setFormSaving();

      client.request('/organizations/', {
        method: 'POST',
        data: removeDataStorageLocationFromFormData(data),
        host: regionUrl,
        success: onSubmitSuccess,
        error: onSubmitError,
      });
    },
    [client]
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

        <Form
          initialData={{defaultTeam: true}}
          submitLabel={t('Create Organization')}
          apiEndpoint="/organizations/"
          apiMethod="POST"
          onSubmit={submitOrganizationCreate}
          onSubmitSuccess={(createdOrg: OrganizationSummary) => {
            const hasCustomerDomain =
              ConfigStore.get('features').has('system:multi-region');
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
              name="dataStorageLocation"
              label={t('Data Storage Location')}
              help={tct(
                "Choose where to store your organization's data. Please note, you won't be able to change locations once your organization has been created. [learnMore:Learn More]",
                {learnMore: <a href={DATA_STORAGE_DOCS_LINK} />}
              )}
              choices={regionChoices}
              inline={false}
              stacked
              required
            />
          )}
          {termsUrl && privacyUrl && (
            <TermsWrapper hasDataConsent={hasDataConsent}>
              <CheckboxField
                name="agreeTerms"
                label={tct(
                  'I agree to the [termsLink:Terms of Service] and the [privacyLink:Privacy Policy]',
                  {
                    termsLink: <ExternalLink href={termsUrl} />,
                    privacyLink: <ExternalLink href={privacyUrl} />,
                  }
                )}
                inline={false}
                stacked
                required
              />
            </TermsWrapper>
          )}
          <DataConsentCheck />
          {!isSelfHosted && ConfigStore.get('features').has('relocation:enabled') && (
            <div>
              {tct('[relocationLink:Relocating from self-hosted?]', {
                relocationLink: <a href={relocationUrl} />,
              })}
            </div>
          )}
        </Form>
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

export default OrganizationCreate;

const TermsWrapper = styled('div')<{hasDataConsent?: boolean}>`
  margin-bottom: ${p => (p.hasDataConsent ? '0' : '16px')};
`;
