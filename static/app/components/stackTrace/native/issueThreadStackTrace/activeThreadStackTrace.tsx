import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {IssueStackTraceFrameContext} from 'sentry/components/stackTrace/issueStackTrace/issueStackTraceFrameContext';
import {supportsAppleCrashReport} from 'sentry/components/stackTrace/native/appleCrashReport';
import {NativeIssueFrameActions} from 'sentry/components/stackTrace/native/frame/actions/nativeIssueActions';
import {NativeAppleCrashReportContent} from 'sentry/components/stackTrace/native/nativeAppleCrashReportContent';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {t} from 'sentry/locale';
import type {ExceptionValue} from 'sentry/types/event';

import {useIssueThreadStackTraceContext} from './context';

export function ActiveThreadStackTrace() {
  const {activeThreadModel, event, projectSlug} = useIssueThreadStackTraceContext();
  const {activeException, activeThread, exception, stacktrace} = activeThreadModel;

  if (!stacktrace) {
    return <Text variant="muted">{t('No stack trace available')}</Text>;
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
