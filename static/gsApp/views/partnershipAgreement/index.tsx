import {useMutation} from '@tanstack/react-query';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {NarrowLayout} from 'sentry/components/narrowLayout';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {PartnershipAgreementProps} from 'sentry/types/overrides';
import {fetchMutation} from 'sentry/utils/queryClient';

export default function PartnershipAgreement({
  partnerDisplayName,
  agreements,
  onSubmitSuccess,
  organizationSlug,
}: PartnershipAgreementProps) {
  const mutation = useMutation({
    mutationFn: (data: Record<string, never>) =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/partnership-agreements/`,
        method: 'POST',
        data,
      }),
    onSuccess: onSubmitSuccess,
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {},
    onSubmit: async ({value}) => {
      try {
        await mutation.mutateAsync(value);
      } catch {
        // Prevent an unhandled rejection; the API client handles the request error.
      }
    },
  });

  const tos = (
    <ExternalLink href="https://sentry.io/terms/">terms of service</ExternalLink>
  );
  const privacyPolicy = (
    <ExternalLink href="https://sentry.io/privacy/">privacy policy</ExternalLink>
  );

  return (
    <NarrowLayout>
      <SentryDocumentTitle title={t('Partnership Agreement')} />
      <Stack gap="xl">
        <Stack gap="md">
          <Heading as="h3" size="xl">
            {t('Partnership Agreement')}
          </Heading>
          <Text as="p">
            {agreements.includes('partner_presence')
              ? tct(
                  "This organization is created in partnership with [partnerDisplayName]. By pressing continue, you acknowledge that you have agreed to Sentry's [tos] and [privacyPolicy] through [partnerDisplayName] and are aware of the partner's presence in the organization as a manager.",
                  {partnerDisplayName, tos, privacyPolicy}
                )
              : tct(
                  "This organization is created in partnership with [partnerDisplayName]. By pressing continue, you acknowledge that you have agreed to Sentry's [tos] and [privacyPolicy] through [partnerDisplayName].",
                  {partnerDisplayName, tos, privacyPolicy}
                )}
          </Text>
        </Stack>
        <form.AppForm form={form}>
          <Flex justify="end" borderTop="secondary" paddingTop="xl" paddingBottom="xl">
            <form.SubmitButton>{t('Continue')}</form.SubmitButton>
          </Flex>
        </form.AppForm>
      </Stack>
    </NarrowLayout>
  );
}
