import * as React from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import StackTraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import StackTraceContentV2 from 'sentry/components/events/interfaces/crashContent/stackTrace/contentV2';
import {isStacktraceNewestFirst} from 'sentry/components/events/interfaces/utils';
import Hovercard, {Body} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EntryType, Event} from 'sentry/types/event';
import {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {Theme} from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';

import findBestThread from './events/interfaces/threads/threadSelector/findBestThread';
import getThreadStacktrace from './events/interfaces/threads/threadSelector/getThreadStacktrace';

const REQUEST_DELAY = 100;
const HOVERCARD_DELAY = 400;

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

type Props = {
  issueId: string;
  organization: Organization;
  api: Client;
  theme: Theme;
  groupingCurrentLevel?: number;
  eventId?: string;
  projectSlug?: string;
  className?: string;
  children: React.ReactNode;
};

function StackTracePreview(props: Props): React.ReactElement {
  const [loadingVisible, setLoadingVisible] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading');
  const [event, setEvent] = React.useState<Event | null>(null);

  const delayTimeout = React.useRef<number | null>(null);
  const loaderTimeout = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (loaderTimeout.current !== null) {
        window.clearTimeout(loaderTimeout.current);
      }
      if (delayTimeout.current !== null) {
        window.clearTimeout(delayTimeout.current);
      }
    };
  }, []);

  const fetchData = React.useCallback(async () => {
    // Data is already loaded
    if (event) {
      return;
    }

    // These are required props to load data
    if (!props.issueId && !props.eventId && !props.projectSlug) {
      return;
    }

    loaderTimeout.current = window.setTimeout(() => {
      setLoadingVisible(true);
    }, HOVERCARD_DELAY);

    try {
      const evt = await props.api.requestPromise(
        props.eventId && props.projectSlug
          ? `/projects/${props.organization.slug}/${props.projectSlug}/events/${props.eventId}/`
          : `/issues/${props.issueId}/events/latest/?collapse=stacktraceOnly`
      );
      clearTimeout(loaderTimeout.current);
      setEvent(evt);
      setStatus('loaded');
      setLoadingVisible(false);
    } catch {
      clearTimeout(loaderTimeout.current);
      setEvent(null);
      setStatus('error');
      setLoadingVisible(false);
    }
  }, []);

  const handleMouseEnter = React.useCallback(() => {
    delayTimeout.current = window.setTimeout(fetchData, REQUEST_DELAY);
  }, [fetchData]);

  const handleMouseLeave = React.useCallback(() => {
    if (delayTimeout.current) {
      window.clearTimeout(delayTimeout.current);
      delayTimeout.current = null;
    }
  }, []);

  // Not sure why we need to stop propagation, maybe to to prevent the hovercard from closing?
  // If we are doing this often, maybe it should be part of the hovercard component.
  const handleStacktracePreviewClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const stacktrace = React.useMemo(() => {
    if (event) {
      return getStacktrace(event);
    }
    return null;
  }, [event]);

  const includeSystemFrames = React.useMemo(() => {
    return stacktrace?.frames?.every(frame => !frame.inApp) ?? false;
  }, [stacktrace]);

  return (
    <span
      className={props.className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <StyledHovercard
        body={
          status === 'loading' && !loadingVisible ? null : status === 'loading' ? (
            <NoStackTraceWrapper onClick={handleStacktracePreviewClick}>
              <LoadingIndicator hideMessage size={32} />
            </NoStackTraceWrapper>
          ) : status === 'error' ? (
            <NoStackTraceWrapper onClick={handleStacktracePreviewClick}>
              {t('Failed to load stack trace.')}
            </NoStackTraceWrapper>
          ) : !stacktrace ? (
            <NoStackTraceWrapper onClick={handleStacktracePreviewClick}>
              {t('There is no stack trace available for this issue.')}
            </NoStackTraceWrapper>
          ) : !event ? null : (
            <div onClick={handleStacktracePreviewClick}>
              {!!props.organization.features?.includes('grouping-stacktrace-ui') ? (
                <StackTraceContentV2
                  data={stacktrace}
                  expandFirstFrame={false}
                  includeSystemFrames={includeSystemFrames}
                  platform={event.platform ?? 'other'}
                  newestFirst={isStacktraceNewestFirst()}
                  event={event}
                  groupingCurrentLevel={props.groupingCurrentLevel}
                  isHoverPreviewed
                />
              ) : (
                <StackTraceContent
                  data={stacktrace}
                  expandFirstFrame={false}
                  includeSystemFrames={includeSystemFrames}
                  platform={event.platform ?? 'other'}
                  newestFirst={isStacktraceNewestFirst()}
                  event={event}
                  isHoverPreviewed
                />
              )}
            </div>
          )
        }
        position="right"
        modifiers={{
          flip: {
            enabled: false,
          },
          preventOverflow: {
            padding: 20,
            enabled: true,
            boundariesElement: 'viewport',
          },
        }}
        state={
          status === 'loading' && loadingVisible
            ? 'loading'
            : !stacktrace
            ? 'empty'
            : 'done'
        }
        tipBorderColor={props.theme.border}
        tipColor={props.theme.background}
      >
        {props.children}
      </StyledHovercard>
    </span>
  );
}

export {StackTracePreview};

const StyledHovercard = styled(Hovercard)<{state: 'loading' | 'empty' | 'done'}>`
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

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
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

export default withApi(withTheme(StackTracePreview));
