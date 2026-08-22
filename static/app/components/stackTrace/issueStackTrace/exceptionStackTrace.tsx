import type {ComponentType} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {
  RelatedExceptionsTree,
  ToggleRelatedExceptionsButton,
  useHiddenExceptions,
} from 'sentry/components/stackTrace/exceptionGroup';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
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

import {IssueFrameActions} from './issueFrameActions';
import {IssueStackTraceFrameContext} from './issueStackTraceFrameContext';
import {
  formatExceptionsAsText,
  getExceptionEntryMeta,
  getOrderedExceptions,
  resolveExceptionFields,
} from './utils';

export interface IssueStackTraceFrameListProps {
  event: Event;
  hasScmSourceContext: boolean;
  stacktrace: StacktraceType;
  exceptionIndex?: number;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  meta?: StackTraceMeta;
  minifiedStacktrace?: StacktraceType;
}

interface IssueExceptionStackTraceProps {
  event: Event;
  values: ExceptionValue[];
  frameListComponent?: ComponentType<IssueStackTraceFrameListProps>;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  hasScmSourceContext?: boolean;
  isStandalone?: boolean;
}

export function IssueExceptionStackTrace({
  event,
  frameListComponent: FrameListComponent = IssueStackTraceFrameList,
  groupingCurrentLevel,
  hasScmSourceContext = false,
  isStandalone = false,
  values,
}: IssueExceptionStackTraceProps) {
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);
  const {rawEntryMeta, exceptionValuesMeta} = getExceptionEntryMeta(event, isStandalone);
  const exceptions = getOrderedExceptions(values, isNewestFirst, view);
  const firstVisibleExceptionIndex = exceptions.findIndex(
    exception =>
      exception.mechanism?.parent_id === undefined ||
      !hiddenExceptions[exception.mechanism.parent_id]
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
            isStandalone,
          })}
        </RawStackTraceText>
      </Container>
    );
  }

  if (exceptions.length === 1) {
    const exception = exceptions[0]!;
    const exceptionMeta = exceptionValuesMeta?.[exception.exceptionIndex];
    const {type, module, value} = resolveExceptionFields(exception, isMinified);
    const hasExceptionInfo = Boolean(type || value);

    return (
      <Stack gap="lg">
        {hasExceptionInfo ? (
          <Stack gap="sm">
            <Container>
              <ExceptionHeader type={type} module={module} />
            </Container>
            <ExceptionDescription
              value={value}
              mechanism={exception.mechanism}
              meta={exceptionMeta}
            />
          </Stack>
        ) : null}
        <ErrorBoundary customComponent={null}>
          <StacktraceBanners event={event} stacktrace={exception.stacktrace} />
        </ErrorBoundary>
        <FrameListComponent
          event={event}
          exceptionIndex={isStandalone ? undefined : exception.exceptionIndex}
          groupingCurrentLevel={groupingCurrentLevel}
          hasScmSourceContext={hasScmSourceContext}
          meta={isStandalone ? rawEntryMeta : exceptionMeta?.stacktrace}
          minifiedStacktrace={exception.rawStacktrace ?? undefined}
          stacktrace={exception.stacktrace}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Text variant="muted">
        {tn(
          'There is %s chained exception in this event.',
          'There are %s chained exceptions in this event.',
          exceptions.length
        )}
      </Text>
      <Separator orientation="horizontal" border="primary" />
      {exceptions.map((exception, index) => {
        if (
          exception.mechanism?.parent_id !== undefined &&
          hiddenExceptions[exception.mechanism.parent_id]
        ) {
          return null;
        }

        const exceptionId = exception.mechanism?.exception_id;
        const {type, module, value} = resolveExceptionFields(exception, isMinified);

        return (
          <Disclosure
            key={exceptionId ?? exception.exceptionIndex}
            defaultExpanded={index === firstVisibleExceptionIndex}
            id={defined(exceptionId) ? `exception-${exceptionId}` : undefined}
          >
            <Disclosure.Title
              trailingItems={
                <ToggleRelatedExceptionsButton
                  exception={exception}
                  hiddenExceptions={hiddenExceptions}
                  toggleRelatedExceptions={toggleRelatedExceptions}
                  values={values}
                />
              }
            >
              <ExceptionHeader type={type} module={module} />
            </Disclosure.Title>
            <Disclosure.Content>
              <Stack gap="sm">
                <ExceptionDescription
                  value={value}
                  mechanism={exception.mechanism}
                  meta={exceptionValuesMeta?.[exception.exceptionIndex]}
                  gap="lg"
                />
                <RelatedExceptionsTree
                  exception={exception}
                  allExceptions={values}
                  newestFirst={isNewestFirst}
                  onExceptionClick={expandException}
                />
                {index === firstVisibleExceptionIndex ? (
                  <ErrorBoundary customComponent={null}>
                    <StacktraceBanners event={event} stacktrace={exception.stacktrace} />
                  </ErrorBoundary>
                ) : null}
                <FrameListComponent
                  event={event}
                  exceptionIndex={exception.exceptionIndex}
                  groupingCurrentLevel={groupingCurrentLevel}
                  hasScmSourceContext={hasScmSourceContext}
                  meta={exceptionValuesMeta?.[exception.exceptionIndex]?.stacktrace}
                  minifiedStacktrace={exception.rawStacktrace ?? undefined}
                  stacktrace={exception.stacktrace}
                />
              </Stack>
            </Disclosure.Content>
          </Disclosure>
        );
      })}
    </Stack>
  );
}

export function IssueStackTraceFrameList({
  event,
  exceptionIndex,
  groupingCurrentLevel,
  hasScmSourceContext,
  meta,
  minifiedStacktrace,
  stacktrace,
}: IssueStackTraceFrameListProps) {
  const platform = getStacktracePlatform(event, stacktrace);

  return (
    <StackTraceProvider
      event={event}
      exceptionIndex={exceptionIndex}
      hasScmSourceContext={hasScmSourceContext}
      meta={meta}
      minifiedStacktrace={minifiedStacktrace}
      platform={platform}
      rowPolicy={createStackTraceRowPolicy({groupingCurrentLevel})}
      stacktrace={stacktrace}
    >
      <StackTraceFrames
        frameActionsComponent={IssueFrameActions}
        frameContextComponent={IssueStackTraceFrameContext}
      />
    </StackTraceProvider>
  );
}
