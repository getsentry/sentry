import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';

import {HiddenFramesToggleAction} from 'sentry/components/stackTrace/frame/actions/hiddenFramesToggle';
import {useStackTraceFrameContext} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';

import {GroupingFrameMarker} from './groupingFrameMarker';

/**
 * Trailing actions for native frame rows, after any leading `children`.
 * Symbolicator status, the Go-to-images-loaded link and the chevron live in
 * the header.
 */
export function NativeFrameActions({children}: {children?: React.ReactNode}) {
  const {frame, hiddenFrameCount, isUsedForGrouping} = useStackTraceFrameContext();

  return (
    <Flex align="center" justify="end" wrap="wrap" gap="xs" minWidth={0}>
      {children}
      {hiddenFrameCount ? <HiddenFramesToggleAction /> : null}
      {isUsedForGrouping ? <GroupingFrameMarker /> : null}
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
    </Flex>
  );
}

export function NativeDefaultActions() {
  return <NativeFrameActions />;
}
