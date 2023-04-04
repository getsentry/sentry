import EmptyMessage from 'sentry/components/emptyMessage';
import type {StacktraceFilenameQuery} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebug';
import {Panel} from 'sentry/components/panels';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ExceptionValue, Group, PlatformType} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_VIEW} from 'sentry/types/stacktrace';
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
  platform: PlatformType;
  stacktrace: ExceptionValue['stacktrace'];
  debugFrames?: StacktraceFilenameQuery[];
  expandFirstFrame?: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  meta?: Record<any, any>;
  newestFirst?: boolean;
  stackView?: STACK_VIEW;
};

const StackTrace = ({
  stackView,
  stacktrace,
  chainedException,
  debugFrames,
  platform,
  newestFirst,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  data,
  expandFirstFrame,
  event,
  meta,
}: Props) => {
  if (!defined(stacktrace)) {
    return null;
  }

  if (
    stackView === STACK_VIEW.APP &&
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
    stackView === STACK_VIEW.FULL ||
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
        debugFrames={debugFrames}
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
      debugFrames={debugFrames}
    />
  );
};

export default StackTrace;
