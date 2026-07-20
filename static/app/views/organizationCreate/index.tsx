import {useCallback} from 'react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {CheckboxField} from 'sentry/components/forms/fields/checkboxField';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Form} from 'sentry/components/forms/form';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {getSignupLocalities} from 'sentry/utils/cells';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {
  PROJECT_CREATION_ORIGIN_ORG_CREATION,
  PROJECT_CREATION_ORIGIN_QUERY_KEY,
} from 'sentry/views/projectInstall/projectCreationOrigin';

export const DATA_STORAGE_DOCS_LINK =
  'https://docs.sentry.io/product/accounts/choose-your-data-center';

const DataConsentCheck = OverrideOrDefault({
  overrideName: 'component:data-consent-org-creation-checkbox',
  defaultComponent: null,
});

function OrganizationCreate() {
  const termsUrl = ConfigStore.get('termsUrl');
  const privacyUrl = ConfigStore.get('privacyUrl');
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const relocationUrl = normalizeUrl('/relocation/');
  const localityOptions = getSignupLocalities();
  const client = useApi();

  const hasDataConsent =
    getOverride('component:data-consent-org-creation-checkbox') !== undefined;

  // This is a trimmed down version of the logic in ApiForm. It validates the
  // form data prior to submitting the request, and overrides the request host
  // with the selected region's URL if one is provided.
  const submitOrganizationCreate: OnSubmitCallback = useCallback(
    (data, onSubmitSuccess, onSubmitError, _event, formModel) => {
      if (!formModel.validateForm()) {
        return;
      }
      const host = ConfigStore.get('links').sentryUrl;

      addLoadingMessage(t('Creating Organization\u2026'));
      formModel.setFormSaving();

      client.request('/organizations/', {
        method: 'POST',
        data,
        host,
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
            // One-shot seed for sticky journey origin on /projects/new/. Must
            // ride on the URL: this redirect is a full page reload
            // (testableWindowLocation.assign), often onto a customer-domain
            // host, so sessionStorage set here would not survive. Dedicated
            // query key — not `referrer`, which getting-started back uses for
            // autofill and would clobber this mid-journey.
            let nextUrl = normalizeUrl(
              `/organizations/${createdOrg.slug}/projects/new/?${PROJECT_CREATION_ORIGIN_QUERY_KEY}=${PROJECT_CREATION_ORIGIN_ORG_CREATION}`,
              {forceCustomerDomain: hasCustomerDomain}
            );
            if (hasCustomerDomain) {
              nextUrl = `${createdOrg.links.organizationUrl}${nextUrl}`;
            }
            // redirect to project creation *(BYPASS REACT ROUTER AND FORCE PAGE REFRESH TO GRAB CSRF TOKEN)*
            testableWindowLocation.assign(nextUrl);
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
            autoComplete="organization"
            placeholder={t('e.g. My Company')}
            inline={false}
            flexibleControlStateSize
            stacked
            required
          />
          {localityOptions.length > 1 && (
            <SelectField
              name="dataStorageLocation"
              label={t('Data Storage Location')}
              help={tct(
                "Choose where to store your organization's data. Please note, you won't be able to change locations once your organization has been created. [learnMore:Learn More]",
                {learnMore: <a href={DATA_STORAGE_DOCS_LINK} />}
              )}
              options={localityOptions}
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
