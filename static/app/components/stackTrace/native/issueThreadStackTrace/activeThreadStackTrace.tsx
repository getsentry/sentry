import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {
  IssueExceptionStackTrace,
  IssueStackTraceFrameList,
  type IssueStackTraceFrameListProps,
} from 'sentry/components/stackTrace/issueStackTrace/exceptionStackTrace';
import {IssueFrameActions} from 'sentry/components/stackTrace/issueStackTrace/issueFrameActions';
import {IssueStackTraceFrameContext} from 'sentry/components/stackTrace/issueStackTrace/issueStackTraceFrameContext';
import {supportsAppleCrashReport} from 'sentry/components/stackTrace/native/appleCrashReport';
import {NativeIssueFrameActions} from 'sentry/components/stackTrace/native/frame/actions/nativeIssueActions';
import {NativeAppleCrashReportContent} from 'sentry/components/stackTrace/native/nativeAppleCrashReportContent';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {t} from 'sentry/locale';
import type {ExceptionValue} from 'sentry/types/event';
import {isNativePlatform} from 'sentry/utils/platform';

import {useIssueThreadStackTraceContext} from './context';

export function ActiveThreadStackTrace() {
  const {
    activeThreadModel,
    event,
    groupingCurrentLevel,
    hasScmSourceContext,
    projectSlug,
  } = useIssueThreadStackTraceContext();
  const {activeException, activeThread, exception, stacktrace} = activeThreadModel;
  const {view} = useStackTraceViewState();
  const isNativeStackTrace = isNativePlatform(activeThreadModel.platform);
  const shouldRenderExceptionStackTraces =
    !!exception?.values?.length && (view !== 'raw' || !stacktrace);

  if (shouldRenderExceptionStackTraces) {
    return (
      <IssueExceptionStackTrace
        values={exception.values}
        event={event}
        groupingCurrentLevel={groupingCurrentLevel}
        hasScmSourceContext={hasScmSourceContext}
        frameListComponent={NativeIssueStackTraceFrameList}
      />
    );
  }

  if (!stacktrace) {
    return <Text variant="muted">{t('No stack trace available')}</Text>;
  }

  return (
    <Stack gap="lg">
      <ExceptionDetails exception={activeException} />
      {activeException?.stacktrace ? (
        <ErrorBoundary customComponent={null}>
          <StacktraceBanners event={event} stacktrace={activeException.stacktrace} />
        </ErrorBoundary>
      ) : null}
      {isNativeStackTrace ? (
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
      ) : (
        <StackTraceFrames
          frameActionsComponent={IssueFrameActions}
          frameContextComponent={IssueStackTraceFrameContext}
        />
      )}
    </Stack>
  );
}

function NativeIssueStackTraceFrameList(props: IssueStackTraceFrameListProps) {
  const {
    event,
    exceptionIndex,
    groupingCurrentLevel,
    hasScmSourceContext,
    meta,
    minifiedStacktrace,
    stacktrace,
  } = props;
  const platform = getStacktracePlatform(event, stacktrace);

  if (isNativePlatform(platform)) {
    return (
      <NativeStackTraceProvider
        event={event}
        stacktrace={stacktrace}
        minifiedStacktrace={minifiedStacktrace}
        groupingCurrentLevel={groupingCurrentLevel}
        hasScmSourceContext={hasScmSourceContext}
        exceptionIndex={exceptionIndex}
        meta={meta}
        platform={platform}
      >
        <NativeStackTraceFrames
          frameActionsComponent={NativeIssueFrameActions}
          frameContextComponent={IssueStackTraceFrameContext}
        />
      </NativeStackTraceProvider>
    );
  }

  return <IssueStackTraceFrameList {...props} />;
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
    <Stack gap="sm">
      <Container>
        <ExceptionHeader type={exception.type} module={exception.module} />
      </Container>
      <ExceptionDescription value={exception.value} mechanism={exception.mechanism} />
    </Stack>
  );
}
