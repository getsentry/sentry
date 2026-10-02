import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {
  IssueExceptionStackTrace,
  IssueStackTraceFrameList,
} from 'sentry/components/stackTrace/issueStackTrace/exceptionStackTrace';
import {supportsAppleCrashReport} from 'sentry/components/stackTrace/native/appleCrashReport';
import {NativeAppleCrashReportContent} from 'sentry/components/stackTrace/native/nativeAppleCrashReportContent';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrameList} from 'sentry/components/stackTrace/stackTraceFrameList';
import {t} from 'sentry/locale';
import type {ExceptionValue} from 'sentry/types/event';
import {isNativePlatform} from 'sentry/utils/platform';

import {useIssueThreadStackTraceContext} from './context';

export function ActiveThreadStackTrace() {
  const {
    activeThreadModel,
    isShared,
    event,
    groupingCurrentLevel,
    hasScmSourceContext,
    projectSlug,
  } = useIssueThreadStackTraceContext();
  const {
    activeException,
    activeThread,
    exception,
    stacktrace,
    minifiedStacktrace,
    stacktraceMeta,
  } = activeThreadModel;
  const {view} = useStackTraceViewState();
  const isNativeStackTrace = isNativePlatform(activeThreadModel.platform);
  const showAppleCrashReport =
    !isShared &&
    view === 'raw' &&
    !!exception &&
    !!stacktrace &&
    isNativeStackTrace &&
    supportsAppleCrashReport(event.platform);

  const FrameList = isShared ? StackTraceFrameList : IssueStackTraceFrameList;

  if (exception?.values.length && !showAppleCrashReport) {
    return (
      <IssueExceptionStackTrace
        key={activeThread?.id}
        values={exception.values}
        event={event}
        groupingCurrentLevel={groupingCurrentLevel}
        hasScmSourceContext={hasScmSourceContext}
        frameListComponent={FrameList}
        showBanners={!isShared}
      />
    );
  }

  if (!stacktrace) {
    return <Text variant="muted">{t('No stack trace available')}</Text>;
  }

  return (
    <Stack gap="lg">
      <ExceptionDetails exception={activeException} />
      {!isShared && activeException?.stacktrace ? (
        <ErrorBoundary customComponent={null}>
          <StacktraceBanners event={event} stacktrace={activeException.stacktrace} />
        </ErrorBoundary>
      ) : null}
      {showAppleCrashReport ? (
        <NativeAppleCrashReportContent
          key={activeThread?.id}
          eventId={event.id}
          projectSlug={projectSlug}
          threadId={activeThread?.id}
        />
      ) : (
        <FrameList
          key={activeThread?.id}
          event={event}
          stacktrace={stacktrace}
          minifiedStacktrace={minifiedStacktrace}
          groupingCurrentLevel={groupingCurrentLevel}
          hasScmSourceContext={hasScmSourceContext}
          meta={stacktraceMeta}
        />
      )}
    </Stack>
  );
}

export function IssueThreadStackTraceSuspectCommits() {
  const {event, group, projectSlug, isShared} = useIssueThreadStackTraceContext();

  if (!group || isShared) {
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
    <Stack gap="sm">
      <Container>
        <ExceptionHeader type={exception.type} module={exception.module} />
      </Container>
      <ExceptionDescription value={exception.value} mechanism={exception.mechanism} />
    </Stack>
  );
}
