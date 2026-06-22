import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {
  RelatedExceptionsTree,
  ToggleRelatedExceptionsButton,
  useHiddenExceptions,
} from 'sentry/components/stackTrace/exceptionGroup';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {IssueFrameActions} from 'sentry/components/stackTrace/issueStackTrace/issueFrameActions';
import {IssueStackTraceFrameContext} from 'sentry/components/stackTrace/issueStackTrace/issueStackTraceFrameContext';
import {
  getExceptionEntryMeta,
  formatExceptionsAsText,
  getOrderedExceptions,
  resolveExceptionFields,
} from 'sentry/components/stackTrace/issueStackTrace/utils';
import {supportsAppleCrashReport} from 'sentry/components/stackTrace/native/appleCrashReport';
import {NativeIssueFrameActions} from 'sentry/components/stackTrace/native/frame/actions/nativeIssueActions';
import {NativeAppleCrashReportContent} from 'sentry/components/stackTrace/native/nativeAppleCrashReportContent';
import {useInheritedNativeDisplayOptions} from 'sentry/components/stackTrace/native/nativeStackTraceContext';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {RawStackTraceText} from 'sentry/components/stackTrace/rawStackTrace';
import {createStackTraceRowPolicy} from 'sentry/components/stackTrace/rowPolicy';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {StackTraceMeta} from 'sentry/components/stackTrace/types';
import {t, tn} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils/defined';
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
      <ExceptionStackTrace
        values={exception.values}
        event={event}
        groupingCurrentLevel={groupingCurrentLevel}
        hasScmSourceContext={hasScmSourceContext}
      />
    );
  }

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
    </Flex>
  );
}

function ExceptionStackTrace({
  event,
  groupingCurrentLevel,
  hasScmSourceContext,
  values,
}: {
  event: Event;
  groupingCurrentLevel: Group['metadata']['current_level'];
  hasScmSourceContext: boolean;
  values: ExceptionValue[];
}) {
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);
  const {exceptionValuesMeta} = getExceptionEntryMeta(event, false);
  const exceptions = getOrderedExceptions(values, isNewestFirst, view);
  const firstVisibleExceptionIndex = exceptions.findIndex(
    exc =>
      exc.mechanism?.parent_id === undefined || !hiddenExceptions[exc.mechanism.parent_id]
  );

  if (exceptions.length === 0) {
    return <Text variant="muted">{t('No stack trace available')}</Text>;
  }

  if (view === 'raw') {
    return (
      <Container border="primary" radius="md">
        <RawStackTraceText>
          {formatExceptionsAsText({
            exceptions,
            platform: event.platform,
            isMinified,
            isStandalone: false,
          })}
        </RawStackTraceText>
      </Container>
    );
  }

  if (exceptions.length === 1) {
    const exc = exceptions[0]!;
    const excMeta = exceptionValuesMeta?.[exc.exceptionIndex];

    return (
      <SingleExceptionStackTrace
        exception={exc}
        event={event}
        groupingCurrentLevel={groupingCurrentLevel}
        hasScmSourceContext={hasScmSourceContext}
        exceptionMeta={excMeta}
        stackTraceMeta={excMeta?.stacktrace}
      />
    );
  }

  return (
    <Flex direction="column" gap="lg">
      <Text variant="muted">
        {tn(
          'There is %s chained exception in this event.',
          'There are %s chained exceptions in this event.',
          exceptions.length
        )}
      </Text>
      <Separator orientation="horizontal" border="primary" />
      {exceptions.map((exc, idx) => {
        if (
          exc.mechanism?.parent_id !== undefined &&
          hiddenExceptions[exc.mechanism.parent_id]
        ) {
          return null;
        }

        const exceptionId = exc.mechanism?.exception_id;
        const {type, module, value} = resolveExceptionFields(exc, isMinified);

        return (
          <Disclosure
            key={exceptionId ?? exc.exceptionIndex}
            defaultExpanded={idx === firstVisibleExceptionIndex}
            id={defined(exceptionId) ? `exception-${exceptionId}` : undefined}
          >
            <Disclosure.Title
              trailingItems={
                <ToggleRelatedExceptionsButton
                  exception={exc}
                  hiddenExceptions={hiddenExceptions}
                  toggleRelatedExceptions={toggleRelatedExceptions}
                  values={values}
                />
              }
            >
              <ExceptionHeader type={type} module={module} />
            </Disclosure.Title>
            <Disclosure.Content>
              <Flex direction="column" gap="sm">
                <ExceptionDescription
                  value={value}
                  mechanism={exc.mechanism}
                  meta={exceptionValuesMeta?.[exc.exceptionIndex]}
                  gap="lg"
                />
                <RelatedExceptionsTree
                  exception={exc}
                  allExceptions={values}
                  newestFirst={isNewestFirst}
                  onExceptionClick={expandException}
                />
                {idx === firstVisibleExceptionIndex ? (
                  <ErrorBoundary customComponent={null}>
                    <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
                  </ErrorBoundary>
                ) : null}
                <StackTraceFrameList
                  stacktrace={exc.stacktrace}
                  minifiedStacktrace={exc.rawStacktrace ?? undefined}
                  event={event}
                  groupingCurrentLevel={groupingCurrentLevel}
                  hasScmSourceContext={hasScmSourceContext}
                  exceptionIndex={exc.exceptionIndex}
                  meta={exceptionValuesMeta?.[exc.exceptionIndex]?.stacktrace}
                />
              </Flex>
            </Disclosure.Content>
          </Disclosure>
        );
      })}
    </Flex>
  );
}

function SingleExceptionStackTrace({
  event,
  exception,
  exceptionMeta,
  groupingCurrentLevel,
  hasScmSourceContext,
  stackTraceMeta,
}: {
  event: Event;
  exception: ExceptionValue & {exceptionIndex: number; stacktrace: StacktraceType};
  groupingCurrentLevel: Group['metadata']['current_level'];
  hasScmSourceContext: boolean;
  exceptionMeta?: Record<any, any>;
  stackTraceMeta?: StackTraceMeta;
}) {
  const {isMinified} = useStackTraceViewState();
  const {type, module, value} = resolveExceptionFields(exception, isMinified);
  const hasExceptionInfo = Boolean(type || value);

  return (
    <Flex direction="column" gap="lg">
      {hasExceptionInfo ? (
        <Flex direction="column" gap="sm">
          <Container>
            <ExceptionHeader type={type} module={module} />
          </Container>
          <ExceptionDescription
            value={value}
            mechanism={exception.mechanism}
            meta={exceptionMeta}
          />
        </Flex>
      ) : null}
      <ErrorBoundary customComponent={null}>
        <StacktraceBanners event={event} stacktrace={exception.stacktrace} />
      </ErrorBoundary>
      <StackTraceFrameList
        stacktrace={exception.stacktrace}
        minifiedStacktrace={exception.rawStacktrace ?? undefined}
        event={event}
        groupingCurrentLevel={groupingCurrentLevel}
        hasScmSourceContext={hasScmSourceContext}
        exceptionIndex={exception.exceptionIndex}
        meta={stackTraceMeta}
      />
    </Flex>
  );
}

function StackTraceFrameList({
  event,
  exceptionIndex,
  groupingCurrentLevel,
  hasScmSourceContext,
  meta,
  minifiedStacktrace,
  stacktrace,
}: {
  event: Event;
  groupingCurrentLevel: Group['metadata']['current_level'];
  hasScmSourceContext: boolean;
  stacktrace: StacktraceType;
  exceptionIndex?: number;
  meta?: StackTraceMeta;
  minifiedStacktrace?: StacktraceType;
}) {
  const inheritedDisplayOptions = useInheritedNativeDisplayOptions();
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
        inheritedDisplayOptions={inheritedDisplayOptions}
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

  return (
    <StackTraceProvider
      event={event}
      hasScmSourceContext={hasScmSourceContext}
      exceptionIndex={exceptionIndex}
      stacktrace={stacktrace}
      minifiedStacktrace={minifiedStacktrace}
      meta={meta}
      platform={platform}
      rowPolicy={createStackTraceRowPolicy({groupingCurrentLevel})}
    >
      <StackTraceFrames
        frameContextComponent={IssueStackTraceFrameContext}
        frameActionsComponent={IssueFrameActions}
      />
    </StackTraceProvider>
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
