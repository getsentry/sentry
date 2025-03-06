import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import type {PartnershipAgreementProps} from 'sentry/types/hooks';

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
