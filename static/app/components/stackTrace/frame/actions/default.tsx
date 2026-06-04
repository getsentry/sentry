import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';

import {ChevronAction} from './chevron';
import {HiddenFramesToggleAction} from './hiddenFramesToggle';

/**
 * Default trailing actions rendered for every frame row:
 * hidden-frames toggle, repeated-frame badge, in-app badge, and chevron.
 */
export function DefaultFrameActions() {
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
