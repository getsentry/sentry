import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import type {JsonFormObject} from 'sentry/components/forms/types';
import {t, tct} from 'sentry/locale';

import {DataConsentSettingsHeader} from 'getsentry/views/legalAndCompliance/utils';

const StyledExternalLink = styled(ExternalLink)`
  white-space: nowrap;
`;

const formGroups: readonly JsonFormObject[] = [
  {
    title: t('Service Data Usage'),
    fields: [
      () => <DataConsentSettingsHeader key="data-consent-settings-header" />,
      {
        name: 'aggregatedDataConsent',
        type: 'boolean',
        label: t('Use of aggregated identifying data'),
        help: tct(
          'Toggle on to let Sentry use your error messages, stack traces, spans, and DOM interactions data for issue workflow and other product improvements. [learnMorelink:Learn more].',
          {
            learnMorelink: (
              <StyledExternalLink href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-aggregated-identifying-data" />
            ),
          }
        ),
        disabled: ({isTouchCustomerAndNeedsMsaUpdate, hasBillingAccess, isSuperuser}) =>
          (isTouchCustomerAndNeedsMsaUpdate || !hasBillingAccess) && !isSuperuser,
        disabledReason: ({isTouchCustomerAndNeedsMsaUpdate, hasBillingAccess}) =>
          isTouchCustomerAndNeedsMsaUpdate
            ? t(
                'These changes require updates to your account. Please contact your customer success manager to learn more.'
              )
            : hasBillingAccess
              ? null
              : t(
                  "You don't have access to manage these billing and subscription details."
                ),
      },
    ],
  },
];

export default formGroups;
