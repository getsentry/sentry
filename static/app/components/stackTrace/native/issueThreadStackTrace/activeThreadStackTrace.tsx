import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {IssueFrameActions} from 'sentry/components/stackTrace/issueStackTrace/issueFrameActions';
import {IssueStackTraceFrameContext} from 'sentry/components/stackTrace/issueStackTrace/issueStackTraceFrameContext';
import {supportsAppleCrashReport} from 'sentry/components/stackTrace/native/appleCrashReport';
import {NativeIssueFrameActions} from 'sentry/components/stackTrace/native/frame/actions/nativeIssueActions';
import {NativeAppleCrashReportContent} from 'sentry/components/stackTrace/native/nativeAppleCrashReportContent';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {createStackTraceRowPolicy} from 'sentry/components/stackTrace/rowPolicy';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {t} from 'sentry/locale';
import type {ExceptionValue} from 'sentry/types/event';
import {isNativePlatform} from 'sentry/utils/platform';

import {useActiveThreadContext, useIssueThreadStackTraceContext} from './context';

export function ActiveThreadStackTrace() {
  const {event, groupingCurrentLevel, hasScmSourceContext, projectSlug} =
    useIssueThreadStackTraceContext();
  const {activeException, activeThread, exception, platform, stacktrace} =
    useActiveThreadContext();
  const rowPolicy = useMemo(
    () => createStackTraceRowPolicy({groupingCurrentLevel}),
    [groupingCurrentLevel]
  );

  if (!stacktrace) {
    return <NoStackTrace>{t('No stack trace available')}</NoStackTrace>;
  }

  if (!isNativePlatform(platform)) {
    return (
      <StackTraceProvider
        event={event}
        hasScmSourceContext={hasScmSourceContext}
        rowPolicy={rowPolicy}
        stacktrace={stacktrace}
        platform={platform}
      >
        <StackTraceFrames
          frameContextComponent={FrameContent}
          frameActionsComponent={IssueFrameActions}
        />
      </StackTraceProvider>
    );
  }

  return (
    <Flex direction="column" gap="lg">
      <ExceptionDetails exception={activeException} />
      {activeException?.stacktrace ? (
        <ErrorBoundary customComponent={null}>
          <StacktraceBanners event={event} stacktrace={activeException.stacktrace} />
        </ErrorBoundary>
      ) : null}
      <NativeStackTraceFrames
        frameActionsComponent={NativeIssueFrameActions}
        frameContextComponent={IssueStackTraceFrameContext}
        rawContent={
          exception && supportsAppleCrashReport(event.platform) ? (
            <NativeAppleCrashReportContent
              eventId={event.id}
              projectSlug={projectSlug}
              threadId={activeThread?.id}
            />
          ) : undefined
        }
      />
    </Flex>
  );
}

export function IssueThreadStackTraceSuspectCommits() {
  const {event, group, projectSlug} = useIssueThreadStackTraceContext();

  if (!group) {
    return null;
  }

  return (
    <ErrorBoundary mini message={t('There was an error loading suspect commits')}>
      <SuspectCommits projectSlug={projectSlug} eventId={event.id} group={group} />
    </ErrorBoundary>
  );
}

function ExceptionDetails({exception}: {exception: ExceptionValue | undefined}) {
  if (!exception) {
    return null;
  }

  const hasExceptionInfo = Boolean(exception.type || exception.value);
  if (!hasExceptionInfo) {
    return null;
  }

  return (
    <Flex direction="column" gap="sm">
      <Container>
        <ExceptionHeader type={exception.type} module={exception.module} />
      </Container>
      <ExceptionDescription value={exception.value} mechanism={exception.mechanism} />
    </Flex>
  );
}

const NoStackTrace = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
