import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ChevronAction} from 'sentry/components/stackTrace/frame/actions/chevron';
import {HiddenFramesToggleAction} from 'sentry/components/stackTrace/frame/actions/hiddenFramesToggle';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';

/**
 * Default trailing actions for native frame rows. Mirrors the generic
 * DefaultFrameActions but tailored for native — symbolicator status and the
 * Go-to-images-loaded link are rendered inline in the header itself.
 */
export function NativeDefaultActions() {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frame, hiddenFrameCount, timesRepeated} = useStackTraceFrameContext();

  return (
    <Fragment>
      {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
      {timesRepeated > 0 ? (
        <Tooltip
          title={tn('Frame repeated %s time', 'Frame repeated %s times', timesRepeated)}
          skipWrapper
        >
          <Tag
            icon={<IconRefresh size="xs" />}
            variant="muted"
            aria-label={tn(
              'Frame repeated %s time',
              'Frame repeated %s times',
              timesRepeated
            )}
          >
            {timesRepeated}
          </Tag>
        </Tooltip>
      ) : null}
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      {hasAnyExpandableFrames ? <ChevronAction /> : null}
    </Fragment>
  );
}
