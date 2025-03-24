import CheckboxField from 'sentry/components/forms/fields/checkboxField';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export default function DataConsentOrgCreationCheckbox() {
  return (
    <CheckboxField
      name="aggregatedDataConsent"
      label={tct(
        'I agree to let Sentry use my service data for product improvements. [dataConsentLink: Learn more].',
        {
          dataConsentLink: (
            <ExternalLink href="https://docs.sentry.io/security-legal-pii/security/ai-ml-policy/" />
          ),
        }
      )}
      inline={false}
      stacked
    />
  );
}
