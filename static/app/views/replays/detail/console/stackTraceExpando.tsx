import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import StackTraceContentV2 from 'sentry/components/events/interfaces/crashContent/stackTrace/contentV2';
import StackTraceContentV3 from 'sentry/components/events/interfaces/crashContent/stackTrace/contentV3';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PlatformType} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {isNativePlatform} from 'sentry/utils/platform';
import useApi from 'sentry/utils/useApi';

const HOVERCARD_CONTENT_DELAY = 400;

export const STACKTRACE_PREVIEW_TOOLTIP_DELAY = 1000;

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

type Props = {
  children: React.ReactNode;
  issueId: string;
  organization: Organization;
  className?: string;
  eventId?: string;
  groupingCurrentLevel?: number;
  projectSlug?: string;
};

function StackTracePreview(props: Props): React.ReactElement {
  const api = useApi();

  const [loadingVisible, setLoadingVisible] = useState<boolean>(false);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [event, setEvent] = useState<Event | null>(null);

  const loaderTimeoutRef = useRef<number | undefined>(undefined);

  const fetchData = useCallback(async () => {
    // Data is already loaded
    if (event) {
      return;
    }

    // These are required props to load data
    if (!props.issueId && !props.eventId && !props.projectSlug) {
      return;
    }

    loaderTimeoutRef.current = window.setTimeout(
      () => setLoadingVisible(true),
      HOVERCARD_CONTENT_DELAY
    );

    try {
      const evt = await api.requestPromise(
        props.eventId && props.projectSlug
          ? `/projects/${props.organization.slug}/${props.projectSlug}/events/${props.eventId}/`
          : `/issues/${props.issueId}/events/latest/?collapse=stacktraceOnly`
      );
      window.clearTimeout(loaderTimeoutRef.current);
      setEvent(evt);
      setStatus('loaded');
      setLoadingVisible(false);
    } catch {
      window.clearTimeout(loaderTimeoutRef.current);
      setEvent(null);
      setStatus('error');
      setLoadingVisible(false);
    }
  }, [
    event,
    api,
    props.organization.slug,
    props.projectSlug,
    props.eventId,
    props.issueId,
  ]);

  const handleOnClick = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Not sure why we need to stop propagation, maybe to prevent the
  // hovercard from closing? If we are doing this often, maybe it should be
  // part of the hovercard component.
  const handleStackTracePreviewClick = useCallback(
    (e: React.MouseEvent) => void e.stopPropagation(),
    []
  );

  const stacktrace = useMemo(() => (event ? getStacktrace(event) : null), [event]);

  const traceChildren = (
    <Fragment>
      {status === 'loading' && !loadingVisible ? null : status === 'loading' ? (
        <NoStackTraceWrapper onClick={handleStackTracePreviewClick}>
          <LoadingIndicator hideMessage size={24} />
        </NoStackTraceWrapper>
      ) : status === 'error' ? (
        <NoStackTraceWrapper onClick={handleStackTracePreviewClick}>
          {t('Failed to load stack trace.')}
        </NoStackTraceWrapper>
      ) : !stacktrace ? (
        <NoStackTraceWrapper onClick={handleStackTracePreviewClick}>
          {t('There is no stack trace available for this issue.')}
        </NoStackTraceWrapper>
      ) : !event ? null : (
        <div onClick={handleStackTracePreviewClick}>
          <StackTracePreviewContent
            event={event}
            stacktrace={stacktrace}
            groupingCurrentLevel={props.groupingCurrentLevel}
            orgFeatures={props.organization.features}
          />
        </div>
      )}
    </Fragment>
  );
  return (
    <InlineTraceback className={props.className}>
      <Button
        size="zero"
        borderless
        icon={<IconStack size="xs" />}
        onClick={handleOnClick}
        aria-label="View Stacktrace"
      />
      {props.children}
      {traceChildren}
    </InlineTraceback>
  );
}

const NoStackTraceWrapper = styled('div')`
  color: ${p => p.theme.subText};
  padding: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
`;

const InlineTraceback = styled('span')`
  .traceback .frame .title {
    background: transparent;
    font-size: ${p => p.theme.gray400};
  }
`;

export default StackTracePreview;
