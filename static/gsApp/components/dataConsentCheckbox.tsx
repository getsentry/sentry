import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';

/**
 * Label content for the aggregated data consent checkbox shown on the
 * organization creation form. The checkbox field itself is rendered by the
 * scraps form in `sentry/views/organizationCreate`; this override only supplies
 * the (getsentry-only) label copy via the
 * `component:data-consent-org-creation-checkbox` override.
 */
export function DataConsentOrgCreationCheckbox() {
  return tct(
    'I agree to let Sentry use my service data for product improvements. [dataConsentLink: Learn more].',
    {
      dataConsentLink: (
        <ExternalLink href="https://docs.sentry.io/security-legal-pii/security/ai-ml-policy/" />
      ),
    }
  );
}
