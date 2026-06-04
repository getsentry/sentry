import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

const IMAGE_INSIGHT_KEYS = new Set([
  'image_optimization',
  'alternate_icons_optimization',
]);

function isImageInsightTimedOut(insight: ProcessedInsight): boolean {
  return !!insight.timedOut && IMAGE_INSIGHT_KEYS.has(insight.key);
}

export function InsightTimedOutWarning({insight}: {insight: ProcessedInsight}) {
  if (!isImageInsightTimedOut(insight)) {
    return null;
  }

  return (
    <Tooltip
      isHoverable
      title={
        <span>
          {t(
            'This app has a high number of images and was not fully analyzed. Only a subset of results are shown.'
          )}
          <br />
          <br />
          {t(
            'For complete results, run your app through Launchpad locally: github.com/getsentry/launchpad'
          )}
        </span>
      }
    >
      <Flex align="center">
        <IconWarning size="sm" variant="warning" />
      </Flex>
    </Tooltip>
  );
}
