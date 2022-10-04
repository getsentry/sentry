import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import StackTraceContentV2 from 'sentry/components/events/interfaces/crashContent/stackTrace/contentV2';
import StackTraceContentV3 from 'sentry/components/events/interfaces/crashContent/stackTrace/contentV3';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from 'sentry/components/events/interfaces/threads/threadSelector/getThreadStacktrace';
import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import {Body, Hovercard} from 'sentry/components/hovercard';
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

const REQUEST_DELAY = 100;
const HOVERCARD_CONTENT_DELAY = 400;

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
  children: React.ReactNode;
  issueId: string;
  eventId?: string;
  groupingCurrentLevel?: number;
  projectSlug?: string;
};

function StackTracePreview(props: StackTracePreviewProps): React.ReactElement {
  const api = useApi();
  const organization = useOrganization();

  const [loadingVisible, setLoadingVisible] = useState<boolean>(false);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [event, setEvent] = useState<Event | null>(null);

  const delayTimeoutRef = useRef<number | undefined>(undefined);
  const loaderTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(loaderTimeoutRef.current);
      window.clearTimeout(delayTimeoutRef.current);
    };
  }, []);

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
          ? `/projects/${organization.slug}/${props.projectSlug}/events/${props.eventId}/`
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
  }, [event, api, organization.slug, props.projectSlug, props.eventId, props.issueId]);

  const handleMouseEnter = useCallback(() => {
    window.clearTimeout(delayTimeoutRef.current);
    delayTimeoutRef.current = window.setTimeout(fetchData, REQUEST_DELAY);
  }, [fetchData]);

  const handleMouseLeave = useCallback(() => {
    window.clearTimeout(delayTimeoutRef.current);
    delayTimeoutRef.current = undefined;
  }, []);

  // Not sure why we need to stop propagation, maybe to prevent the
  // hovercard from closing? If we are doing this often, maybe it should be
  // part of the hovercard component.
  const handleStackTracePreviewClick = useCallback(
    (e: React.MouseEvent) => void e.stopPropagation(),
    []
  );

  const stacktrace = useMemo(() => (event ? getStacktrace(event) : null), [event]);

  const hasGroupingStacktraceUI = organization.features.includes(
    'grouping-stacktrace-ui'
  );

  return (
    <Wrapper
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid="stacktrace-preview"
      hasGroupingStacktraceUI={hasGroupingStacktraceUI}
    >
      <StacktraceHovercard
        body={
          status === 'loading' && !loadingVisible ? null : status === 'loading' ? (
            <NoStackTraceWrapper onClick={handleStackTracePreviewClick}>
              <LoadingIndicator hideMessage size={32} />
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
                orgFeatures={organization.features}
              />
            </div>
          )
        }
        displayTimeout={200}
        position="right"
        state={
          status === 'loading' && loadingVisible
            ? 'loading'
            : !stacktrace
            ? 'empty'
            : 'done'
        }
        tipBorderColor="border"
        tipColor="background"
      >
        {props.children}
      </StacktraceHovercard>
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

const StacktraceHovercard = styled(Hovercard)<{state: 'loading' | 'empty' | 'done'}>`
  /* Lower z-index to match the modals (10000 vs 10002) to allow stackTraceLinkModal be on top of stack trace preview. */
  z-index: ${p => p.theme.zIndex.modal};
  width: ${p => {
    if (p.state === 'loading') {
      return 'auto';
    }
    if (p.state === 'empty') {
      return '340px';
    }
    return '700px';
  }};

  ${Body} {
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }

  .traceback {
    margin-bottom: 0;
    border: 0;
    box-shadow: none;
  }

  .loading {
    margin: 0 auto;
    .loading-indicator {
      /**
      * Overriding the .less file - for default 64px loader we have the width of border set to 6px
      * For 32px we therefore need 3px to keep the same thickness ratio
      */
      border-width: 3px;
    }
  }

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: none;
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
