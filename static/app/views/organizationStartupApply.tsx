import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {InputField} from 'sentry/components/forms/fields/inputField';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Form, type FormProps} from 'sentry/components/forms/form';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

interface StartupApplication {
  date_added: string;
  id: number;
  startup_name: string;
  status: string;
}

interface MutationVariables {
  contact_email: string;
  founders_name: string;
  founding_date_text: string;
  funding_details: string;
  onSubmitError: Parameters<NonNullable<FormProps['onSubmit']>>[2];
  onSubmitSuccess: Parameters<NonNullable<FormProps['onSubmit']>>[1];
  org_slug: string;
  startup_name: string;
  startup_website: string;
}

function OrganizationStartupApply() {
  const organization = useOrganization();

  const {data: existingApplication, isPending: isChecking} =
    useApiQuery<StartupApplication>(
      [`/organizations/${organization.slug}/startup-application/`],
      {staleTime: 0}
    );

  const {mutate, isPending} = useMutation<
    StartupApplication,
    RequestError,
    MutationVariables
  >({
    mutationFn: ({onSubmitSuccess: _, onSubmitError: __, ...data}) =>
      fetchMutation({
        method: 'POST',
        url: `/organizations/${organization.slug}/startup-application/`,
        data,
      }),
    onSuccess: (response, {onSubmitSuccess}) => {
      onSubmitSuccess?.(response);
      addSuccessMessage(
        'Application submitted! You should hear back within 2-3 business days.'
      );
    },
    onError: (error, {onSubmitError}) => {
      onSubmitError?.({
        responseJSON: error?.responseJSON,
      });
    },
  });

  const onSubmit: NonNullable<FormProps['onSubmit']> = (
    data,
    onSubmitSuccess,
    onSubmitError
  ) => {
    if (isPending) {
      return;
    }

    mutate({
      startup_name: String(data.startup_name || ''),
      startup_website: String(data.startup_website || ''),
      org_slug: String(data.org_slug || ''),
      founders_name: String(data.founders_name || ''),
      contact_email: String(data.contact_email || ''),
      founding_date_text: String(data.founding_date_text || ''),
      funding_details: String(data.funding_details || ''),
      onSubmitSuccess,
      onSubmitError,
    });
  };

  if (isChecking) {
    return <LoadingIndicator />;
  }

  if (existingApplication) {
    return (
      <SentryDocumentTitle title={t('Startup Program')}>
        <Flex direction="column" gap="lg" style={{maxWidth: 600, margin: '0 auto'}}>
          <Heading as="h1">{t('Sentry for Startups')}</Heading>
          <Alert type="info" showIcon>
            {t(
              "You've already submitted an application for %s. You should hear back within 2-3 business days.",
              organization.slug
            )}
          </Alert>
        </Flex>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={t('Startup Program Application')}>
      <Flex direction="column" gap="lg" style={{maxWidth: 600, margin: '0 auto'}}>
        <Heading as="h1">{t('Sentry for Startups')}</Heading>

        <Panel>
          <PanelHeader>{t('Eligibility Requirements')}</PanelHeader>
          <PanelBody>
            <Flex direction="column" gap="xs">
              <Text>
                {t('Founded in the last 2 years')}
              </Text>
              <Text>
                {t('Raised less than $5M in venture capital')}
              </Text>
              <Text>{t('New to paying for Sentry')}</Text>
            </Flex>
            <Text as="p" variant="muted" style={{marginTop: 12}}>
              {t(
                "Make sure you have a free Sentry account set up. If you're a founder in YC or a16z speedrun, check bookface or the deals portal; there's a separate deal for you to consider, but they don't stack."
              )}
            </Text>
          </PanelBody>
        </Panel>

        <Form
          onSubmit={onSubmit}
          submitLabel={isPending ? t('Submitting...') : t('Submit Application')}
          submitDisabled={isPending}
          initialData={{
            org_slug: organization.slug,
          }}
        >
          <Flex direction="column" gap="md">
            <InputField
              name="startup_name"
              label={t('Startup Name')}
              placeholder="Acme Inc."
              required
              inline={false}
              stacked
              disabled={isPending}
            />
            <InputField
              name="startup_website"
              type="url"
              label={t('Startup Website')}
              placeholder="https://www.acme.com"
              required
              inline={false}
              stacked
              disabled={isPending}
            />
            <InputField
              name="org_slug"
              label={t('Sentry Org Slug')}
              help={t(
                'The organization slug is included in the URL of your organization. For example, if your URL is sentry.io/organizations/acme, your slug is "acme".'
              )}
              required
              inline={false}
              stacked
              disabled={isPending}
            />
            <InputField
              name="founders_name"
              label={t('Name(s) of Founder(s)')}
              placeholder="Jane Doe, John Smith"
              required
              inline={false}
              stacked
              disabled={isPending}
            />
            <InputField
              name="contact_email"
              type="email"
              label={t('Email to contact you')}
              placeholder="jane.doe@acme.com"
              required
              inline={false}
              stacked
              disabled={isPending}
            />
            <InputField
              name="founding_date_text"
              label={t('When was your company founded?')}
              placeholder="January 2024"
              required
              inline={false}
              stacked
              disabled={isPending}
            />
            <TextField
              name="funding_details"
              label={t('Funding Details')}
              help={t(
                'Total amount raised and from whom (e.g., $1m from Y Combinator and angel investors)'
              )}
              required
              inline={false}
              stacked
              maxLength={2000}
              disabled={isPending}
            />
          </Flex>
        </Form>

        <Text size="sm" variant="muted">
          {t(
            "By filling out this form, you agree to our privacy policy. You'll generally hear back from us within 2-3 days."
          )}
        </Text>
      </Flex>
    </SentryDocumentTitle>
  );
}

export default OrganizationStartupApply;
