import {StatusIndicator} from '@sentry/scraps/statusIndicator';

import {t} from 'sentry/locale';

const SETTLED_STATUS_PULSE_COUNT = 10;

interface AskSeerQueryStatusIndicatorProps {
  hasResults: boolean;
  isError: boolean;
  isPending: boolean;
  unsupportedReason?: string | null;
}

export function AskSeerQueryStatusIndicator({
  hasResults,
  isError,
  isPending,
  unsupportedReason,
}: AskSeerQueryStatusIndicatorProps) {
  if (isPending) {
    return (
      <StatusIndicator
        variant="accent"
        aria-label={t('Seer is processing your query')}
        animationIterationCount="infinite"
      />
    );
  }

  if (isError) {
    return (
      <StatusIndicator
        variant="danger"
        aria-label={t('Seer could not process your query')}
        animationIterationCount={SETTLED_STATUS_PULSE_COUNT}
      />
    );
  }

  if (unsupportedReason && !hasResults) {
    return (
      <StatusIndicator
        variant="warning"
        aria-label={t('Seer does not support this query')}
        animationIterationCount={SETTLED_STATUS_PULSE_COUNT}
      />
    );
  }

  if (hasResults) {
    return (
      <StatusIndicator
        variant="success"
        aria-label={t('Seer processed your query')}
        animationIterationCount={SETTLED_STATUS_PULSE_COUNT}
      />
    );
  }

  return null;
}
