import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';

import {PlanTier} from 'getsentry/types';

export function getDataCategoryTooltipText(
  planTier: PlanTier | undefined,
  category: DataCategory | string
): string | null {
  switch (category) {
    case DataCategory.TRANSACTIONS:
      return t(
        'Transactions are sent when your service receives a request and sends a response.'
      );
    case DataCategory.REPLAYS:
      return t(
        'Session Replays are video-like reproductions of your users’ sessions navigating your app or website.'
      );
    case DataCategory.ATTACHMENTS:
      return t('Attachments are files attached to errors, such as minidumps.');
    case DataCategory.ERRORS:
      return t(
        'Errors are sent every time an SDK catches a bug. You can send them manually too, if you want.'
      );
    case DataCategory.MONITOR_SEATS:
      return t(
        'Cron Monitors track if your scheduled jobs run as expected. Get one monitor for free, and can purchase more by setting %s budget.',
        planTier === PlanTier.AM3 ? 'a pay-as-you-go' : 'an on-demand'
      );
    case DataCategory.SPANS:
      return t(
        'Tracing is enabled by spans. A span represents a single operation of work within a trace'
      );
    default:
      return null;
  }
}
