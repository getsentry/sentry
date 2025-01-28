import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import {NativeContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/nativeContent';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import {GroupPreviewHovercard} from 'sentry/components/groupPreviewTooltip/groupPreviewHovercard';
import {
  useDelayedLoadingState,
  usePreviewEvent,
} from 'sentry/components/groupPreviewTooltip/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {isNativePlatform} from 'sentry/utils/platform';

export function getStacktrace(event: Event): StacktraceType | null {
  const exceptionsWithStacktrace =
    event.entries
      .find(e => e.type === EntryType.EXCEPTION)
      ?.data?.values.filter(({stacktrace}: any) => defined(stacktrace)) ?? [];

  const exceptionStacktrace: StacktraceType | undefined = isStacktraceNewestFirst()
    ? exceptionsWithStacktrace[exceptionsWithStacktrace.length - 1]?.stacktrace
    : exceptionsWithStacktrace[0]?.stacktrace;

  if (exceptionStacktrace) {
    return exceptionStacktrace;
  }

  const threads =
    event.entries.find(e => e.type === EntryType.THREADS)?.data?.values ?? [];
  const bestThread = findBestThread(threads);

  if (!bestThread) {
    return null;
  }

  const bestThreadStacktrace = getThreadStacktrace(false, bestThread);

  if (bestThreadStacktrace) {
    return bestThreadStacktrace;
  }

  return null;
}

export function StackTracePreviewContent({
  event,
  stacktrace,
  groupingCurrentLevel,
}: {
  event: Event;
  stacktrace: StacktraceType;
  groupingCurrentLevel?: number;
}) {
  const includeSystemFrames = useMemo(() => {
    return stacktrace?.frames?.every(frame => !frame.inApp) ?? false;
  }, [stacktrace]);

  const framePlatform = stacktrace?.frames?.find(frame => !!frame.platform)?.platform;
  const platform = (framePlatform ?? event.platform ?? 'other') as PlatformKey;
  const newestFirst = isStacktraceNewestFirst();

  const commonProps = {
    data: stacktrace,
    includeSystemFrames,
    platform,
    newestFirst,
    event,
    isHoverPreviewed: true,
  };

  if (isNativePlatform(platform)) {
    return (
      <NativeContent
        {...commonProps}
        groupingCurrentLevel={groupingCurrentLevel}
        hideIcon
      />
    );
  }

  return <StackTraceContent {...commonProps} expandFirstFrame={false} hideIcon />;
}

type StackTracePreviewProps = {
  children: React.ReactChild;
  groupId: string;
  eventId?: string;
  groupingCurrentLevel?: number;
  projectSlug?: string;
  query?: string;
};

interface StackTracePreviewBodyProps
  extends Pick<
    StackTracePreviewProps,
    'groupId' | 'eventId' | 'groupingCurrentLevel' | 'projectSlug' | 'query'
  > {
  onRequestBegin: () => void;
  onRequestEnd: () => void;
  onUnmount: () => void;
}

function StackTracePreviewBody({
  groupId,
  groupingCurrentLevel,
  onRequestBegin,
  onRequestEnd,
  onUnmount,
  query,
}: StackTracePreviewBodyProps) {
  const {data, isPending, isError} = usePreviewEvent({groupId, query});

  useEffect(() => {
    if (isPending) {
      onRequestBegin();
    } else {
      onRequestEnd();
    }

    return onUnmount;
  }, [isPending, onRequestBegin, onRequestEnd, onUnmount]);

  const stacktrace = useMemo(() => (data ? getStacktrace(data) : null), [data]);

  if (isPending) {
    return (
      <NoStackTraceWrapper>
        <LoadingIndicator hideMessage size={32} />
      </NoStackTraceWrapper>
    );
  }

  if (isError) {
    return <NoStackTraceWrapper>{t('Failed to load stack trace.')}</NoStackTraceWrapper>;
  }

  if (stacktrace && data) {
    return (
      <StackTracePreviewWrapper>
        <StackTracePreviewContent
          event={data}
          stacktrace={stacktrace}
          groupingCurrentLevel={groupingCurrentLevel}
        />
      </StackTracePreviewWrapper>
    );
  }

  return (
    <NoStackTraceWrapper>
      {t('There is no stack trace available for this issue.')}
    </NoStackTraceWrapper>
  );
}

function StackTracePreview({children, ...props}: StackTracePreviewProps) {
  const {shouldShowLoadingState, onRequestBegin, onRequestEnd, reset} =
    useDelayedLoadingState();

  return (
    <span data-testid="stacktrace-preview">
      <GroupPreviewHovercard
        hide={!shouldShowLoadingState}
        body={
          <StackTracePreviewBody
            onRequestBegin={onRequestBegin}
            onRequestEnd={onRequestEnd}
            onUnmount={reset}
            {...props}
          />
        }
      >
        {children}
      </GroupPreviewHovercard>
    </span>
  );
}

export {StackTracePreview};

const StackTracePreviewWrapper = styled('div')`
  width: 700px;

  .traceback {
    margin-bottom: 0;
    border: 0;
  }
`;

const NoStackTraceWrapper = styled('div')`
  color: ${p => p.theme.subText};
  padding: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
`;
