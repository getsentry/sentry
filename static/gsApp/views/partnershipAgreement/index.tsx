import {ExternalLink} from '@sentry/scraps/link';

import Form from 'sentry/components/forms/form';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import type {PartnershipAgreementProps} from 'sentry/types/hooks';

import SentryNewPartnershipAgreement from './sentryNewClaimFixed';

// Adapter component to handle prop mismatch
function SentryNewAdapter({
  organizationSlug,
  onSubmitSuccess,
}: {
  organizationSlug: string | undefined;
  onSubmitSuccess?: () => void;
}) {
  // Create a minimal organization object for the SentryNew component
  const organization = {
    slug: organizationSlug || '',
    name: organizationSlug || '', // Use slug as fallback name
    id: '', // Will work without ID for claiming
  } as any;

  return (
    <SentryNewPartnershipAgreement
      organization={organization}
      onSubmitSuccess={onSubmitSuccess}
    />
  );
}

export default function PartnershipAgreement({
  partnerDisplayName,
  agreements,
  onSubmitSuccess,
  organizationSlug,
}: PartnershipAgreementProps) {
  const tos = (
    <ExternalLink href="https://sentry.io/terms/">terms of service</ExternalLink>
  );
  const privacyPolicy = (
    <ExternalLink href="https://sentry.io/privacy/">privacy policy</ExternalLink>
  );

  // Handle evaluation organizations (sentrynew)
  if (agreements.includes('evaluation' as any)) {
    return (
      <SentryNewAdapter
        organizationSlug={organizationSlug}
        onSubmitSuccess={onSubmitSuccess}
      />
    );
  }

  // Handle standard partnership agreements
  return (
    <NarrowLayout>
      <Form
        apiMethod="POST"
        apiEndpoint={`/organizations/${organizationSlug}/partnership-agreements/`}
        submitLabel={t('Continue')}
        onSubmitSuccess={onSubmitSuccess}
      >
        {agreements.includes('partner_presence')
          ? tct(
              "This organization is created in partnership with [partnerDisplayName]. By pressing continue, you acknowledge that you have agreed to Sentry's [tos] and [privacyPolicy] through [partnerDisplayName] and are aware of the partner's presence in the organization as a manager.",
              {partnerDisplayName, tos, privacyPolicy}
            )
          : tct(
              "This organization is created in partnership with [partnerDisplayName]. By pressing continue, you acknowledge that you have agreed to Sentry's [tos] and [privacyPolicy] through [partnerDisplayName].",
              {partnerDisplayName, tos, privacyPolicy}
            )}
      </Form>
    </NarrowLayout>
  );
}
