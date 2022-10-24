import {useCallback, useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import StackTraceContentV2 from 'sentry/components/events/interfaces/crashContent/stackTrace/contentV2';
import StackTraceContentV3 from 'sentry/components/events/interfaces/crashContent/stackTrace/contentV3';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import {GroupPreviewHovercard} from 'sentry/components/groupPreviewTooltip/groupPreviewHovercard';
import {useDelayedLoadingState} from 'sentry/components/groupPreviewTooltip/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {PlatformType} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

function getStacktrace(event: Event): StacktraceType | null {
  const exceptionsWithStacktrace =
    event.entries
      .find(e => e.type === EntryType.EXCEPTION)
      ?.data?.values.filter(({stacktrace}) => defined(stacktrace)) ?? [];

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

function StackTracePreviewContent({
  event,
  stacktrace,
  orgFeatures = [],
  groupingCurrentLevel,
}: {
  event: Event;
  stacktrace: StacktraceType;
  groupingCurrentLevel?: number;
  orgFeatures?: string[];
}) {
  const includeSystemFrames = useMemo(() => {
    return stacktrace?.frames?.every(frame => !frame.inApp) ?? false;
  }, [stacktrace]);

  const framePlatform = stacktrace?.frames?.find(frame => !!frame.platform)?.platform;
  const platform = (framePlatform ?? event.platform ?? 'other') as PlatformType;
  const newestFirst = isStacktraceNewestFirst();

  const commonProps = {
    data: stacktrace,
    expandFirstFrame: false,
    includeSystemFrames,
    platform,
    newestFirst,
    event,
    isHoverPreviewed: true,
  };

  if (orgFeatures.includes('native-stack-trace-v2') && isNativePlatform(platform)) {
    return (
      <StackTraceContentV3 {...commonProps} groupingCurrentLevel={groupingCurrentLevel} />
    );
  }

  if (orgFeatures.includes('grouping-stacktrace-ui')) {
    return (
      <StackTraceContentV2 {...commonProps} groupingCurrentLevel={groupingCurrentLevel} />
    );
  }

  return <StackTraceContent {...commonProps} />;
}

type StackTracePreviewProps = {
  children: React.ReactChild;
  issueId: string;
  eventId?: string;
  groupingCurrentLevel?: number;
  projectSlug?: string;
};

interface StackTracePreviewBodyProps
  extends Pick<
    StackTracePreviewProps,
    'issueId' | 'eventId' | 'groupingCurrentLevel' | 'projectSlug'
  > {
  onRequestBegin: () => void;
  onRequestEnd: () => void;
  onUnmount: () => void;
}

function StackTracePreviewBody({
  issueId,
  eventId,
  groupingCurrentLevel,
  projectSlug,
  onRequestBegin,
  onRequestEnd,
  onUnmount,
}: StackTracePreviewBodyProps) {
  const api = useApi();
  const organization = useOrganization();

  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [event, setEvent] = useState<Event | null>(null);

  const fetchData = useCallback(async () => {
    onRequestBegin();

    // Data is already loaded
    if (event) {
      onRequestEnd();
      return;
    }

    // These are required props to load data
    if (issueId && eventId && !projectSlug) {
      onRequestEnd();
      return;
    }

    try {
      const evt = await api.requestPromise(
        eventId && projectSlug
          ? `/projects/${organization.slug}/${projectSlug}/events/${eventId}/`
          : `/issues/${issueId}/events/latest/?collapse=stacktraceOnly`,
        {query: {referrer: 'api.issues.preview-error'}}
      );
      setEvent(evt);
      setStatus('loaded');
    } catch {
      setEvent(null);
      setStatus('error');
    } finally {
      onRequestEnd();
    }
  }, [
    event,
    issueId,
    eventId,
    projectSlug,
    onRequestEnd,
    onRequestBegin,
    api,
    organization.slug,
  ]);

  useEffect(() => {
    fetchData();

    return () => {
      onUnmount();
    };
  }, [fetchData, onUnmount]);

  const stacktrace = useMemo(() => (event ? getStacktrace(event) : null), [event]);

  switch (status) {
    case 'loading':
      return (
        <NoStackTraceWrapper>
          <LoadingIndicator hideMessage size={32} />
        </NoStackTraceWrapper>
      );
    case 'error':
      return (
        <NoStackTraceWrapper>{t('Failed to load stack trace.')}</NoStackTraceWrapper>
      );
    case 'loaded': {
      if (stacktrace && event) {
        return (
          <StackTracePreviewWrapper>
            <StackTracePreviewContent
              event={event}
              stacktrace={stacktrace}
              groupingCurrentLevel={groupingCurrentLevel}
              orgFeatures={organization.features}
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
    default: {
      return null;
    }
  }
}

function StackTracePreview({children, ...props}: StackTracePreviewProps) {
  const organization = useOrganization();
  const {shouldShowLoadingState, onRequestBegin, onRequestEnd, reset} =
    useDelayedLoadingState();

  const hasGroupingStacktraceUI = organization.features.includes(
    'grouping-stacktrace-ui'
  );

  return (
    <Wrapper
      data-testid="stacktrace-preview"
      hasGroupingStacktraceUI={hasGroupingStacktraceUI}
    >
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
    </Wrapper>
  );
}

export {StackTracePreview};

const Wrapper = styled('span')<{
  hasGroupingStacktraceUI: boolean;
}>`
  ${p =>
    p.hasGroupingStacktraceUI &&
    css`
      display: inline-flex;
      overflow: hidden;
      height: 100%;
      > span:first-child {
        ${p.theme.overflowEllipsis}
      }
    `}
`;

const StackTracePreviewWrapper = styled('div')`
  width: 700px;

  .traceback {
    margin-bottom: 0;
    border: 0;
    box-shadow: none;
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
