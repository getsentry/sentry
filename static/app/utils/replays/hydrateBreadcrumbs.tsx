import * as Sentry from '@sentry/react';
import invariant from 'invariant';

import {t} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {isValidDate} from 'sentry/utils/date/isValidDate';
import {defaultTitle} from 'sentry/utils/replays/getFrameDetails';
import type {BreadcrumbFrame, RawBreadcrumbFrame} from 'sentry/utils/replays/types';
import {isBreadcrumbFrame} from 'sentry/utils/replays/types';
import type {HydratedReplayRecord} from 'sentry/views/explore/replays/types';

// Categories whose SDK types require `data`. Custom breadcrumbs often omit it,
// so only these are worth reporting when it is missing.
const CATEGORIES_WITH_DATA = new Set([
  'console',
  'navigation',
  'replay.mutations',
  'ui.click',
  'ui.keyDown',
  'ui.multiClick',
  'ui.slowClickDetected',
]);

export function hydrateBreadcrumbs(
  replayRecord: HydratedReplayRecord,
  breadcrumbFrames: RawBreadcrumbFrame[]
): BreadcrumbFrame[] {
  const startTimestampMs = replayRecord.started_at.getTime();
  const categoriesMissingData = new Set<string>();

  const hydrated = breadcrumbFrames
    .map((frame: RawBreadcrumbFrame) => {
      try {
        const time = new Date(frame.timestamp * 1000);
        invariant(isValidDate(time), 'breadcrumbFrame.timestamp is invalid');

        if (!frame.data && CATEGORIES_WITH_DATA.has(frame.category)) {
          categoriesMissingData.add(frame.category);
        }

        if (frame.category === 'replay.hydrate-error') {
          frame.data = {
            description: t('Encountered an error while hydrating'),
          };
        }
        return {
          ...frame,
          // Logcat and Timber are used for mobile replays and are considered a console frame instead of a custom breadcrumb frame
          // custom frames might not have a defined category, so we need to set one
          category:
            frame.category === 'Logcat' || frame.category === 'Timber'
              ? 'console'
              : frame.category || defaultTitle(frame) || 'custom',
          offsetMs: Math.abs(time.getTime() - startTimestampMs),
          timestamp: time,
          timestampMs: time.getTime(),
        };
      } catch {
        return;
      }
    })
    .filter(isBreadcrumbFrame);

  if (categoriesMissingData.size > 0) {
    Sentry.logger.warn('Replay: breadcrumb frames are missing data', {
      categories: [...categoriesMissingData].sort().join(','),
      sdk_name: replayRecord.sdk.name,
      sdk_version: replayRecord.sdk.version,
    });
  }

  return hydrated;
}

export function replayInitBreadcrumb(
  replayRecord: HydratedReplayRecord
): BreadcrumbFrame {
  const initialUrl = replayRecord.urls?.[0] ?? replayRecord.tags.url?.join(', ');

  return {
    category: 'replay.init',
    message: initialUrl,
    offsetMs: 0,
    timestamp: replayRecord.started_at,
    timestampMs: replayRecord.started_at.getTime(),
    type: BreadcrumbType.INIT, // For compatibility reasons. See BreadcrumbType
  };
}
