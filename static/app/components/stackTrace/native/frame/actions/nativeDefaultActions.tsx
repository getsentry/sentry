import {Fragment} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';

import {ChevronAction} from 'sentry/components/stackTrace/frame/actions/chevron';
import {HiddenFramesToggleAction} from 'sentry/components/stackTrace/frame/actions/hiddenFramesToggle';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

import {GroupingFrameMarker} from './groupingFrameMarker';

/**
 * Trailing actions for native frame rows, after any leading `children`.
 * Symbolicator status and the Go-to-images-loaded link live in the header.
 */
export function NativeFrameActions({children}: {children?: React.ReactNode}) {
  const {hasAnyExpandableFrames} = useStackTraceContext();
  const {frame, hiddenFrameCount, isUsedForGrouping} = useStackTraceFrameContext();

  return (
    <Fragment>
      <Flex align="center" justify="end" wrap="wrap" gap="xs" minWidth={0}>
        {children}
        {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
        {isUsedForGrouping ? <GroupingFrameMarker /> : null}
        {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      </Flex>
      {hasAnyExpandableFrames ? <ChevronAction /> : null}
    </Fragment>
  );
}

export function NativeDefaultActions() {
  return <NativeFrameActions />;
}
