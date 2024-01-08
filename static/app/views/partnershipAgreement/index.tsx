import Form from 'sentry/components/forms/form';
import ExternalLink from 'sentry/components/links/externalLink';
import NarrowLayout from 'sentry/components/narrowLayout';
import {tct} from 'sentry/locale';

export type ParntershipAgreementType = 'standard' | 'partner_presence';

type Props = {
  agreements: Array<ParntershipAgreementType>,
  partnerDisplayName: string,
  onSubmitSuccess?: () => void;
};

export default function PartnershipAgreement({partnerDisplayName, agreements, onSubmitSuccess}: Props) {
  const tos = <ExternalLink href='https://sentry.io/terms/'>terms of service</ExternalLink>;
  const privacyPolicy = <ExternalLink href='https://sentry.io/privacy/'>privacy policy</ExternalLink>;
  // TODO @athena: Add API call to the form
  return (
    <NarrowLayout>
      <Form submitLabel="Continue" onSubmitSuccess={onSubmitSuccess}>
        {agreements.includes('partner_presence')
          ? tct(
              "This organization is created in partnership with [partnerDisplayName]. By pressing continue, you acknowledge that you have agreed to Sentry's [tos] and [privacyPolicy] through the partner's application and are aware of the partner's presence in the organization as a manager.",
              {partnerDisplayName, tos, privacyPolicy}
            )
          : tct(
              "This organization is created in partnership with [partnerDisplayName]. By pressing continue, you acknowledge that you have agreed to Sentry's [tos] and [privacyPolicy] through the partner's application.",
              {partnerDisplayName, tos, privacyPolicy}
            )
        }
      </Form>
    </NarrowLayout>
  );
}
