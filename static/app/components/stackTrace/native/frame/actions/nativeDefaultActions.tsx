import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';

import {ChevronAction} from 'sentry/components/stackTrace/frame/actions/chevron';
import {HiddenFramesToggleAction} from 'sentry/components/stackTrace/frame/actions/hiddenFramesToggle';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

import {GroupingFrameMarker} from './groupingFrameMarker';

/**
 * Default trailing actions for native frame rows. Mirrors the generic
 * DefaultFrameActions but tailored for native — symbolicator status and the
 * Go-to-images-loaded link are rendered inline in the header itself.
 */
export function NativeDefaultActions() {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frame, hiddenFrameCount, isUsedForGrouping} = useStackTraceFrameContext();

  return (
    <Fragment>
      {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
      {isUsedForGrouping ? <GroupingFrameMarker /> : null}
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      {hasAnyExpandableFrames ? <ChevronAction /> : null}
    </Fragment>
  );
}
