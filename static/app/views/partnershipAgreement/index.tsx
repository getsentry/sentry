import {Label} from 'sentry/components/editableText';
import Form from 'sentry/components/forms/form';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';

export type ParntershipAgreementType = 'standard' | 'partner_presence';

type Props = {
  agreements: Array<ParntershipAgreementType>,
  partnerDisplayName: string,
  onSubmitSuccess?: () => void;
};

export default function PartnershipAgreement({partnerDisplayName, agreements, onSubmitSuccess}: Props) {
  const standardAgreement = tct(
    'This organization is created in partnership with [partnerName]. By pressing continue, you acknowledge that you have agreed to Sentry’s [tosLink] and [ppLink] through the partner’s application[endOfSentence]',
     {
      partnerName: partnerDisplayName,
      tosLink: <a href='https://sentry.io/terms/' target='blank'>terms of service</a>,
      ppLink: <a href='https://sentry.io/privacy/' target='_blank' rel="noreferrer">privacy policy</a>,
      endOfSentence: agreements.length === 1 ? '.' : "",
     }
    );
  const withPartnerPresenceAgreement = <span>{standardAgreement}{t('and are aware of the partner’s presence in the organization as a manager.')}</span>;

  // TODO @athena: Add API call to the form
  return (
    <NarrowLayout>
      <Form submitLabel='Continue' onSubmitSuccess={onSubmitSuccess}>
        <Label isDisabled={false}>
          {agreements.includes('partner_presence') ? withPartnerPresenceAgreement : standardAgreement}
        </Label>
    </Form>
    </NarrowLayout>
  );
}
