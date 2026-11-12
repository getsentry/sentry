import {InfoTip} from '@sentry/scraps/info';

import {getReferrerConfig} from 'sentry/components/events/autofix/autofixReferrer';

export function AutofixReferrerInfoTip({referrer}: {referrer: string | undefined}) {
  const tooltip = getReferrerConfig(referrer).tooltip ?? referrer;

  if (!tooltip) {
    return null;
  }

  return <InfoTip title={tooltip} size="xs" />;
}
