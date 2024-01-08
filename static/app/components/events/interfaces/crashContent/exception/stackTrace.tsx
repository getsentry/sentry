import EmptyMessage from 'sentry/components/emptyMessage';
import {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import Panel from 'sentry/components/panels/panel';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ExceptionValue, Group, PlatformKey} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StackType, StackView} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {isNativePlatform} from 'sentry/utils/platform';

import StackTraceContent from '../stackTrace/content';
import {HierarchicalGroupingContent} from '../stackTrace/hierarchicalGroupingContent';
import {NativeContent} from '../stackTrace/nativeContent';

type Props = {
  chainedException: boolean;
  data: ExceptionValue['stacktrace'];
  event: Event;
  hasHierarchicalGrouping: boolean;
  platform: PlatformKey;
  stackType: StackType;
  stacktrace: ExceptionValue['stacktrace'];
  expandFirstFrame?: boolean;
  frameSourceMapDebuggerData?: FrameSourceMapDebuggerData[];
  groupingCurrentLevel?: Group['metadata']['current_level'];
  meta?: Record<any, any>;
  newestFirst?: boolean;
  stackView?: StackView;
  threadId?: number;
};

function StackTrace({
  stackView,
  stacktrace,
  chainedException,
  platform,
  newestFirst,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  data,
  expandFirstFrame,
  event,
  meta,
  threadId,
  frameSourceMapDebuggerData,
  stackType,
}: Props) {
  if (!defined(stacktrace)) {
    return null;
  }

  if (
    stackView === StackView.APP &&
    (stacktrace.frames ?? []).filter(frame => frame.inApp).length === 0 &&
    !chainedException
  ) {
    return (
      <Panel dashedBorder>
        <EmptyMessage
          icon={<IconWarning size="xl" />}
          title={
            hasHierarchicalGrouping
              ? t('No relevant stack trace has been found!')
              : t('No app only stack trace has been found!')
          }
        />
      </Panel>
    );
  }

  if (!data) {
    return null;
  }

  const includeSystemFrames =
    stackView === StackView.FULL ||
    (chainedException && data.frames?.every(frame => !frame.inApp));
  /**
   * Armin, Markus:
   * If all frames are in app, then no frame is in app.
   * This normally does not matter for the UI but when chained exceptions
   * are used this causes weird behavior where one exception appears to not have a stack trace.
   *
   * It is easier to fix the UI logic to show a non-empty stack trace for chained exceptions
   */

  if (isNativePlatform(platform)) {
    return (
      <NativeContent
        data={data}
        expandFirstFrame={expandFirstFrame}
        includeSystemFrames={includeSystemFrames}
        groupingCurrentLevel={groupingCurrentLevel}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
        meta={meta}
      />
    );
  }

  if (hasHierarchicalGrouping) {
    return (
      <HierarchicalGroupingContent
        data={data}
        expandFirstFrame={expandFirstFrame}
        includeSystemFrames={includeSystemFrames}
        groupingCurrentLevel={groupingCurrentLevel}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
        meta={meta}
      />
    );
  }

  return (
    <StackTraceContent
      data={data}
      expandFirstFrame={expandFirstFrame}
      includeSystemFrames={includeSystemFrames}
      platform={platform}
      newestFirst={newestFirst}
      event={event}
      meta={meta}
      threadId={threadId}
      frameSourceMapDebuggerData={frameSourceMapDebuggerData}
      hideSourceMapDebugger={stackType === StackType.MINIFIED}
    />
  );
}

export default StackTrace;
