import {useMemo} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {getSignupLocalities} from 'sentry/utils/cells';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

export const DATA_STORAGE_DOCS_LINK =
  'https://docs.sentry.io/product/accounts/choose-your-data-center';

const DataConsentCheck = OverrideOrDefault({
  overrideName: 'component:data-consent-org-creation-checkbox',
  defaultComponent: null,
});

/**
 * Payload sent to the organization creation endpoint. Fields are only included
 * when their corresponding form control is displayed, matching the legacy
 * behavior where unrendered fields were never submitted.
 */
type CreateOrganizationPayload = {
  defaultTeam: boolean;
  name: string;
  aggregatedDataConsent?: boolean;
  agreeTerms?: boolean;
  dataStorageLocation?: string;
};

function OrganizationCreate() {
  const termsUrl = ConfigStore.get('termsUrl');
  const privacyUrl = ConfigStore.get('privacyUrl');
  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const relocationUrl = normalizeUrl('/relocation/');
  const localityOptions = getSignupLocalities();

  const hasDataConsent =
    getOverride('component:data-consent-org-creation-checkbox') !== undefined;
  const showTerms = Boolean(termsUrl && privacyUrl);
  const showLocality = localityOptions.length > 1;

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(1, t('Please enter an organization name')),
          defaultTeam: z.boolean(),
          agreeTerms: z.boolean(),
          dataStorageLocation: z.string().nullable(),
          aggregatedDataConsent: z.boolean(),
        })
        .superRefine((value, ctx) => {
          if (showTerms && !value.agreeTerms) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['agreeTerms'],
              message: t('Please agree to the Terms of Service and the Privacy Policy'),
            });
          }
          if (showLocality && value.dataStorageLocation === null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['dataStorageLocation'],
              message: t('Please select a data storage location'),
            });
          }
        }),
    [showTerms, showLocality]
  );

  const mutation = useMutation({
    mutationFn: (data: CreateOrganizationPayload) =>
      fetchMutation<OrganizationSummary>({
        url: '/organizations/',
        method: 'POST',
        data,
        options: {host: ConfigStore.get('links').sentryUrl},
      }),
    onSuccess: createdOrg => {
      const hasCustomerDomain = ConfigStore.get('features').has('system:multi-region');
      let nextUrl = normalizeUrl(`/organizations/${createdOrg.slug}/projects/new/`, {
        forceCustomerDomain: hasCustomerDomain,
      });
      if (hasCustomerDomain) {
        nextUrl = `${createdOrg.links.organizationUrl}${nextUrl}`;
      }
      // redirect to project creation *(BYPASS REACT ROUTER AND FORCE PAGE REFRESH TO GRAB CSRF TOKEN)*
      testableWindowLocation.assign(nextUrl);
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      name: '',
      defaultTeam: true,
      agreeTerms: false,
      dataStorageLocation: null as string | null,
      aggregatedDataConsent: false,
    },
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) => {
      addLoadingMessage(t('Creating Organization…'));

      const data: CreateOrganizationPayload = {
        name: value.name,
        defaultTeam: value.defaultTeam,
      };
      if (showTerms) {
        data.agreeTerms = value.agreeTerms;
      }
      if (showLocality && value.dataStorageLocation !== null) {
        data.dataStorageLocation = value.dataStorageLocation;
      }
      if (hasDataConsent) {
        data.aggregatedDataConsent = value.aggregatedDataConsent;
      }

      return mutation.mutateAsync(data).catch((error: RequestError) => {
        // Surface field-specific errors inline; otherwise show a toast.
        if (!setFieldErrors(formApi, error)) {
          const detail = error.responseJSON?.detail;
          addErrorMessage(
            (typeof detail === 'string' ? detail : detail?.message) ??
              t('Unable to create organization.')
          );
        }
      });
    },
  });

  return (
    <SentryDocumentTitle title={t('Create Organization')}>
      <NarrowLayout showLogout>
        <h3>{t('Create a New Organization')}</h3>
        <p>
          {t(
            "Organizations represent the top level in your hierarchy. You'll be able to bundle a collection of teams within an organization as well as give organization-wide permissions to users."
          )}
        </p>

        <form.AppForm form={form}>
          <form.AppField name="name">
            {field => (
              <field.Layout.Stack label={t('Organization Name')} required>
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  autoComplete="organization"
                  placeholder={t('e.g. My Company')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          {showLocality && (
            <form.AppField name="dataStorageLocation">
              {field => (
                <field.Layout.Stack
                  label={t('Data Storage Location')}
                  hintText={tct(
                    "Choose where to store your organization's data. Please note, you won't be able to change locations once your organization has been created. [learnMore:Learn More]",
                    {learnMore: <a href={DATA_STORAGE_DOCS_LINK} />}
                  )}
                  required
                >
                  <field.Select
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={localityOptions.map(({value, label}) => ({value, label}))}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          )}

          {showTerms && (
            <TermsWrapper hasDataConsent={hasDataConsent}>
              <form.AppField name="agreeTerms">
                {field => (
                  <field.Layout.Stack
                    label={tct(
                      'I agree to the [termsLink:Terms of Service] and the [privacyLink:Privacy Policy]',
                      {
                        termsLink: <ExternalLink href={termsUrl ?? undefined} />,
                        privacyLink: <ExternalLink href={privacyUrl ?? undefined} />,
                      }
                    )}
                    required
                  >
                    <field.Base<HTMLInputElement>>
                      {baseProps => (
                        <Checkbox
                          {...baseProps}
                          checked={field.state.value}
                          onChange={e => field.handleChange(e.target.checked)}
                        />
                      )}
                    </field.Base>
                  </field.Layout.Stack>
                )}
              </form.AppField>
            </TermsWrapper>
          )}

          {hasDataConsent && (
            <form.AppField name="aggregatedDataConsent">
              {field => (
                <field.Layout.Stack label={<DataConsentCheck />}>
                  <field.Base<HTMLInputElement>>
                    {baseProps => (
                      <Checkbox
                        {...baseProps}
                        checked={field.state.value}
                        onChange={e => field.handleChange(e.target.checked)}
                      />
                    )}
                  </field.Base>
                </field.Layout.Stack>
              )}
            </form.AppField>
          )}

          {!isSelfHosted && ConfigStore.get('features').has('relocation:enabled') && (
            <div>
              {tct('[relocationLink:Relocating from self-hosted?]', {
                relocationLink: <a href={relocationUrl} />,
              })}
            </div>
          )}

          <SubmitWrapper>
            <form.SubmitButton>{t('Create Organization')}</form.SubmitButton>
          </SubmitWrapper>
        </form.AppForm>
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

export default OrganizationCreate;

const TermsWrapper = styled('div')<{hasDataConsent?: boolean}>`
  margin-bottom: ${p => (p.hasDataConsent ? '0' : '16px')};
`;

const SubmitWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-top: ${p => p.theme.space.xl};
`;
