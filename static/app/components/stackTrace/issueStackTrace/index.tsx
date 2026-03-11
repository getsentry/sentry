import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {
  LineCoverageProvider,
  useLineCoverageContext,
} from 'sentry/components/events/interfaces/crashContent/exception/lineCoverageContext';
import {LineCoverageLegend} from 'sentry/components/events/interfaces/crashContent/exception/lineCoverageLegend';
import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import Panel from 'sentry/components/panels/panel';
import {
  RelatedExceptionsTree,
  ToggleRelatedExceptionsButton,
  useHiddenExceptions,
} from 'sentry/components/stackTrace/exceptionGroup';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {
  StackTraceViewStateProvider,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {CopyButton, DisplayOptions} from 'sentry/components/stackTrace/toolbar';
import {tn} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {IssueFrameActions} from './issueFrameActions';
import {IssueStackTraceFrameContext} from './issueStackTraceFrameContext';

interface IssueStackTraceProps {
  event: Event;
  values: ExceptionValue[];
}

interface IndexedExceptionValue extends ExceptionValue {
  exceptionIndex: number;
  stacktrace: StacktraceType;
}

function IssueStackTraceLineCoverageLegend() {
  const {hasCoverageData} = useLineCoverageContext();

  if (!hasCoverageData) {
    return null;
  }

  return (
    <Container paddingTop="md">
      <LineCoverageLegend />
    </Container>
  );
}

export function IssueStackTrace({event, values}: IssueStackTraceProps) {
  // Events with thread data are rendered by the Threads section, so IssueStackTrace
  // should bail out in that case.
  const eventHasThreads = event.entries?.some(entry => entry.type === EntryType.THREADS);
  if (eventHasThreads) {
    return null;
  }

  const hasMinifiedStacktrace = values.some(v => v.rawStacktrace !== null);

  return (
    <LineCoverageProvider>
      <StackTraceViewStateProvider
        platform={event.platform}
        hasMinifiedStacktrace={hasMinifiedStacktrace}
      >
        <IssueStackTraceContent event={event} values={values} />
      </StackTraceViewStateProvider>
    </LineCoverageProvider>
  );
}

function IssueStackTraceContent({
  event,
  values,
}: {
  event: Event;
  values: ExceptionValue[];
}) {
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);

  const exceptions = useMemo(() => {
    const indexed = values
      .map((exc, exceptionIndex) => ({...exc, exceptionIndex}))
      .filter((exc): exc is IndexedExceptionValue => exc.stacktrace !== null);
    return isNewestFirst && view !== 'raw' ? indexed.reverse() : indexed;
  }, [values, isNewestFirst, view]);

  const firstVisibleExceptionIndex = exceptions.findIndex(
    exc =>
      exc.mechanism?.parent_id === undefined || !hiddenExceptions[exc.mechanism.parent_id]
  );

  if (exceptions.length === 0) {
    return null;
  }

  if (exceptions.length === 1) {
    const exc = exceptions[0]!;
    const type = isMinified ? (exc.rawType ?? exc.type) : exc.type;
    const module = isMinified ? (exc.rawModule ?? exc.module) : exc.module;
    const value = isMinified ? (exc.rawValue ?? exc.value) : exc.value;
    return (
      <StackTraceProvider
        exceptionIndex={exc.exceptionIndex}
        event={event}
        stacktrace={exc.stacktrace}
        minifiedStacktrace={exc.rawStacktrace ?? undefined}
      >
        <InterimSection
          type={SectionKey.EXCEPTION}
          title="Stack Trace"
          actions={
            <Flex align="center" gap="sm">
              <DisplayOptions />
              <CopyButton />
            </Flex>
          }
        >
          <Flex direction="column" gap="sm">
            <ExceptionHeader type={type} module={module} />
            <ExceptionDescription value={value} mechanism={exc.mechanism} />
          </Flex>
          <ErrorBoundary customComponent={null}>
            <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
          </ErrorBoundary>
          <StackTraceFrames
            frameContextComponent={IssueStackTraceFrameContext}
            frameActionsComponent={IssueFrameActions}
          />
          <IssueStackTraceLineCoverageLegend />
        </InterimSection>
      </StackTraceProvider>
    );
  }

  return (
    <InterimSection
      type={SectionKey.EXCEPTION}
      title="Stack Trace"
      actions={
        <Flex align="center" gap="sm">
          <DisplayOptions />
          <CopyButton
            getCopyText={() =>
              exceptions
                .map(exc =>
                  rawStacktraceContent({
                    data: exc.stacktrace,
                    platform: event.platform,
                  })
                )
                .join('\n\n')
            }
          />
        </Flex>
      }
    >
      <Flex direction="column" gap="lg">
        {view !== 'raw' && (
          <Text variant="muted">
            {tn(
              'There is %s chained exception in this event.',
              'There are %s chained exceptions in this event.',
              exceptions.length
            )}
          </Text>
        )}
        {view !== 'raw' && <Separator orientation="horizontal" border="primary" />}
        {view === 'raw' ? (
          <Panel>
            <RawStackTraceText>
              {exceptions
                .map(exc =>
                  rawStacktraceContent({
                    data: isMinified
                      ? (exc.rawStacktrace ?? exc.stacktrace)
                      : exc.stacktrace,
                    platform: event.platform,
                    exception: exc,
                    isMinified,
                  })
                )
                .join('\n\n')}
            </RawStackTraceText>
          </Panel>
        ) : null}
        {view !== 'raw' &&
          exceptions.map((exc, idx) => {
            if (
              exc.mechanism?.parent_id !== undefined &&
              hiddenExceptions[exc.mechanism.parent_id]
            ) {
              return null;
            }

            const exceptionId = exc.mechanism?.exception_id;
            const excType = isMinified ? (exc.rawType ?? exc.type) : exc.type;
            const excModule = isMinified ? (exc.rawModule ?? exc.module) : exc.module;
            const excValue = isMinified ? (exc.rawValue ?? exc.value) : exc.value;

            return (
              <Disclosure
                key={exceptionId ?? idx}
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
                  <ExceptionHeader type={excType} module={excModule} />
                </Disclosure.Title>
                <Disclosure.Content>
                  <Flex direction="column" gap="sm">
                    <ExceptionDescription
                      value={excValue}
                      mechanism={exc.mechanism}
                      gap="lg"
                    />
                    <RelatedExceptionsTree
                      exception={exc}
                      allExceptions={values}
                      newestFirst={isNewestFirst}
                      onExceptionClick={expandException}
                    />
                    {idx === 0 ? (
                      <ErrorBoundary customComponent={null}>
                        <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
                      </ErrorBoundary>
                    ) : null}
                    <StackTraceProvider
                      exceptionIndex={exc.exceptionIndex}
                      event={event}
                      stacktrace={exc.stacktrace}
                      minifiedStacktrace={exc.rawStacktrace ?? undefined}
                    >
                      <StackTraceFrames
                        frameContextComponent={IssueStackTraceFrameContext}
                        frameActionsComponent={IssueFrameActions}
                      />
                    </StackTraceProvider>
                  </Flex>
                </Disclosure.Content>
              </Disclosure>
            );
          })}
        {view !== 'raw' && <IssueStackTraceLineCoverageLegend />}
      </Flex>
    </InterimSection>
  );
}

const RawStackTraceText = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  overflow: auto;
  font-size: ${p => p.theme.font.size.sm};
`;
