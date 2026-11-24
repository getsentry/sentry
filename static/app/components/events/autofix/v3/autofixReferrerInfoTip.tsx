import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';

import {getReferrerConfig} from 'sentry/components/events/autofix/autofixReferrer';

export function AutofixReferrerInfoTip({referrer}: {referrer: string | undefined}) {
  const tooltip = getReferrerConfig(referrer).tooltip ?? referrer;

  if (!tooltip) {
    return null;
  }

  return (
    <Flex align="center" justify="center" width="28px" height="28px">
      <InfoTip title={tooltip} size="xs" />
    </Flex>
  );
}
