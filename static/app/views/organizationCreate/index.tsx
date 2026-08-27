import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Checkbox} from '@sentry/scraps/checkbox';
import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getSignupLocalities} from 'sentry/utils/cells';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {
  PROJECT_CREATION_ORIGIN_ORG_CREATION,
  PROJECT_CREATION_ORIGIN_QUERY_KEY,
} from 'sentry/views/projectInstall/projectCreationOrigin';

export const DATA_STORAGE_DOCS_LINK =
  'https://docs.sentry.io/product/accounts/choose-your-data-center';

const DATA_CONSENT_DOCS_LINK =
  'https://docs.sentry.io/security-legal-pii/security/ai-ml-policy/';

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

// Conditionally rendered fields are permissive here and carry their own
// validators, so they are only enforced when their control is displayed.
const schema = z.object({
  name: z.string().min(1, t('Please enter an organization name')),
  defaultTeam: z.boolean(),
  agreeTerms: z.boolean(),
  dataStorageLocation: z.string().nullable(),
  aggregatedDataConsent: z.boolean(),
});

function OrganizationCreate() {
  const {termsUrl, privacyUrl, isSelfHosted, features, links} =
    useLegacyStore(ConfigStore);
  const relocationUrl = normalizeUrl('/relocation/');
  const localityOptions = getSignupLocalities();

  // Sentry does not receive service data when self-hosted, so there is nothing
  // to consent to there.
  const hasDataConsent = !isSelfHosted;
  const showTerms = Boolean(termsUrl && privacyUrl);
  const showLocality = localityOptions.length > 1;

  const mutation = useMutation({
    mutationFn: (data: CreateOrganizationPayload) =>
      fetchMutation<OrganizationSummary>({
        url: getApiUrl('/organizations/'),
        method: 'POST',
        data,
        options: {host: links.sentryUrl},
      }),
    onSuccess: createdOrg => {
      const hasCustomerDomain = features.has('system:multi-region');
      // One-shot seed for sticky journey origin on /projects/new/. Must ride on
      // the URL: this redirect is a full page reload
      // (testableWindowLocation.assign), often onto a customer-domain host, so
      // sessionStorage set here would not survive. Dedicated query key — not
      // `referrer`, which getting-started back uses for autofill and would
      // clobber this mid-journey.
      let nextUrl = normalizeUrl(
        `/organizations/${createdOrg.slug}/projects/new/?${PROJECT_CREATION_ORIGIN_QUERY_KEY}=${PROJECT_CREATION_ORIGIN_ORG_CREATION}`,
        {forceCustomerDomain: hasCustomerDomain}
      );
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
      addLoadingMessage(t('Creating Organization\u2026'));

      const data: CreateOrganizationPayload = {
        name: schema.parse(value).name,
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

      return mutation.mutateAsync(data).catch((error: unknown) => {
        // Surface field-specific errors inline; otherwise show a toast.
        if (error instanceof RequestError && setFieldErrors(formApi, error)) {
          clearIndicators();
          return;
        }
        const detail =
          error instanceof RequestError ? error.responseJSON?.detail : undefined;
        addErrorMessage(
          (typeof detail === 'string' ? detail : detail?.message) ??
            t('Unable to create organization.')
        );
      });
    },
  });

  return (
    <SentryDocumentTitle title={t('Create Organization')}>
      <NarrowLayout showLogout>
        <Stack gap="xl">
          <Stack gap="md">
            <Heading as="h3" size="xl">
              {t('Create a New Organization')}
            </Heading>
            <Text as="p">
              {t(
                "Organizations represent the top level in your hierarchy. You'll be able to bundle a collection of teams within an organization as well as give organization-wide permissions to users."
              )}
            </Text>
          </Stack>

          <form.AppForm form={form}>
            <Stack gap="xl">
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
                <form.AppField
                  name="dataStorageLocation"
                  validators={{
                    onDynamic: z.string(t('Please select a data storage location')),
                  }}
                >
                  {field => (
                    <field.Layout.Stack
                      label={t('Data Storage Location')}
                      hintText={tct(
                        "Choose where to store your organization's data. Please note, you won't be able to change locations once your organization has been created. [learnMore:Learn More]",
                        {learnMore: <ExternalLink href={DATA_STORAGE_DOCS_LINK} />}
                      )}
                      required
                    >
                      <field.Select
                        value={field.state.value}
                        onChange={field.handleChange}
                        options={localityOptions}
                      />
                    </field.Layout.Stack>
                  )}
                </form.AppField>
              )}

              {termsUrl && privacyUrl && (
                <form.AppField
                  name="agreeTerms"
                  validators={{
                    onDynamic: z.literal(
                      true,
                      t('Please agree to the Terms of Service and the Privacy Policy')
                    ),
                  }}
                >
                  {field => (
                    // Label lives inside field.Base so the validation icon it
                    // appends renders after the label rather than between the
                    // checkbox and its text.
                    <field.Base<HTMLInputElement>>
                      {baseProps => (
                        <Flex gap="md" align="center">
                          <Checkbox
                            {...baseProps}
                            checked={field.state.value}
                            onChange={e => field.handleChange(e.target.checked)}
                          />
                          <field.Meta.Label required>
                            {tct(
                              'I agree to the [termsLink:Terms of Service] and the [privacyLink:Privacy Policy]',
                              {
                                termsLink: <ExternalLink href={termsUrl} />,
                                privacyLink: <ExternalLink href={privacyUrl} />,
                              }
                            )}
                          </field.Meta.Label>
                        </Flex>
                      )}
                    </field.Base>
                  )}
                </form.AppField>
              )}

              {hasDataConsent && (
                <form.AppField name="aggregatedDataConsent">
                  {field => (
                    <field.Base<HTMLInputElement>>
                      {baseProps => (
                        <Flex gap="md" align="center">
                          <Checkbox
                            {...baseProps}
                            checked={field.state.value}
                            onChange={e => field.handleChange(e.target.checked)}
                          />
                          <field.Meta.Label>
                            {tct(
                              'I agree to let Sentry use my service data for product improvements. [dataConsentLink: Learn more].',
                              {
                                dataConsentLink: (
                                  <ExternalLink href={DATA_CONSENT_DOCS_LINK} />
                                ),
                              }
                            )}
                          </field.Meta.Label>
                        </Flex>
                      )}
                    </field.Base>
                  )}
                </form.AppField>
              )}

              {!isSelfHosted && features.has('relocation:enabled') && (
                <Text as="p">
                  {tct('[relocationLink:Relocating from self-hosted?]', {
                    relocationLink: <Link to={relocationUrl} />,
                  })}
                </Text>
              )}

              <Flex
                justify="end"
                borderTop="secondary"
                paddingTop="xl"
                paddingBottom="xl"
              >
                <form.SubmitButton>{t('Create Organization')}</form.SubmitButton>
              </Flex>
            </Stack>
          </form.AppForm>
        </Stack>
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

export default OrganizationCreate;
