import styled from '@emotion/styled';

import type {JsonFormObject} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

import {DataConsentSettingsHeader} from 'getsentry/views/legalAndCompliance/utils';

const StyledExternalLink = styled(ExternalLink)`
  white-space: nowrap;
`;

const formGroups: JsonFormObject[] = [
  {
    title: t('Service Data Usage'),
    fields: [
      () => <DataConsentSettingsHeader key="data-consent-settings-header" />,
      {
        name: 'aggregatedDataConsent',
        type: 'boolean',
        label: t('Use of aggregated identifying data'),
        help: tct(
          'Toggle on to let Sentry use your error messages, stack traces, spans, and DOM interactions data for issue workflow and other product improvements. [learnMorelink].',
          {
            learnMorelink: (
              <StyledExternalLink href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-aggregated-identifying-data">
                {t(`Learn more`)}
              </StyledExternalLink>
            ),
          }
        ),
        disabled: ({hasMsaUpdated, hasBillingAccess, isSuperuser}) =>
          (!hasMsaUpdated || !hasBillingAccess) && !isSuperuser,
        disabledReason: ({hasMsaUpdated, hasBillingAccess}) =>
          !hasMsaUpdated
            ? t(
                'These changes require updates to your account. Please contact your customer success manager to learn more.'
              )
            : !hasBillingAccess
              ? t(
                  "You don't have access to manage these billing and subscription details."
                )
              : null,
      },
      {
        name: 'genAIConsent',
        type: 'boolean',
        label: t('Use of identifying data for generative AI features'),
        help: tct(
          'Toggle on to let Sentry send relevant stack trace and code from your linked repositories to third-party AI subprocessors, as disclosed in our [subprocessorLink:subprocessor list]. It will not be used to train any machine learning or large language models. [learnMorelink].',
          {
            subprocessorLink: (
              <ExternalLink href="https://sentry.io/legal/subprocessors/" />
            ),
            learnMorelink: (
              <StyledExternalLink href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-identifying-data-for-generative-ai-features">
                {t(`Learn more`)}
              </StyledExternalLink>
            ),
          }
        ),
        visible: ({isUsRegion}) => isUsRegion,
        disabled: ({isGenAiButtonDisabled}) => isGenAiButtonDisabled,
        disabledReason: ({genAiButtonMessage}) => genAiButtonMessage,
      },
    ],
  },
];

export default formGroups;
