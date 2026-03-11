import {useMemo} from 'react';

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
import {
  prepareSourceMapDebuggerFrameInformation,
  useSourceMapDebuggerData,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {CopyButton, DisplayOptions} from 'sentry/components/stackTrace/toolbar';
import {tn} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
import useProjects from 'sentry/utils/useProjects';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {IssueStackTraceFrameContext} from './issueStackTraceFrameContext';

interface IssueStackTraceProps {
  event: Event;
  values: ExceptionValue[];
  newestFirst?: boolean;
}

interface ExceptionWithDebugData extends ExceptionValue {
  debuggerData: FrameSourceMapDebuggerData[] | undefined;
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
  const eventHasThreads = event.entries?.some(entry => entry.type === EntryType.THREADS);

  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event.projectID]
  );
  const sourceMapDebuggerData = useSourceMapDebuggerData(event, project?.slug ?? '');

  const exceptions = useMemo(() => {
    return values
      .map((exc, idx) => {
        const rawFrames = sourceMapDebuggerData?.exceptions[idx]?.frames;
        return {
          ...exc,
          debuggerData:
            rawFrames && project
              ? rawFrames.map(frame =>
                  prepareSourceMapDebuggerFrameInformation(
                    sourceMapDebuggerData,
                    frame,
                    event,
                    project.platform
                  )
                )
              : undefined,
        };
      })
      .filter((exc): exc is ExceptionWithDebugData => exc.stacktrace !== null)
      .reverse();
  }, [values, sourceMapDebuggerData, project, event]);

  if (eventHasThreads || exceptions.length === 0) {
    return null;
  }

  if (exceptions.length === 1) {
    const exc = exceptions[0]!;
    const actions = (
      <Flex align="center" gap="sm">
        <DisplayOptions />
        <CopyButton />
      </Flex>
    );
    return (
      <LineCoverageProvider>
        <StackTraceViewStateProvider platform={event.platform}>
          <StackTraceProvider
            event={event}
            stacktrace={exc.stacktrace}
            frameSourceMapDebuggerData={exc.debuggerData}
          >
            <InterimSection
              type={SectionKey.EXCEPTION}
              title="Stack Trace"
              actions={actions}
            >
              <Flex direction="column" gap="sm">
                <ExceptionHeader type={exc.type} module={exc.module} />
                <ExceptionDescription value={exc.value} mechanism={exc.mechanism} />
              </Flex>
              <ErrorBoundary customComponent={null}>
                <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
              </ErrorBoundary>
              <StackTraceFrames frameContextComponent={IssueStackTraceFrameContext} />
              <IssueStackTraceLineCoverageLegend />
            </InterimSection>
          </StackTraceProvider>
        </StackTraceViewStateProvider>
      </LineCoverageProvider>
    );
  }

  return (
    <LineCoverageProvider>
      <StackTraceViewStateProvider platform={event.platform}>
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
            <Text variant="muted">
              {tn(
                'There is %s chained exception in this event.',
                'There are %s chained exceptions in this event.',
                exceptions.length
              )}
            </Text>
            <Separator orientation="horizontal" border="primary" />
            {exceptions.map((exc, idx) => (
              <Disclosure
                key={exc.mechanism?.exception_id ?? idx}
                defaultExpanded={idx === 0}
              >
                <Disclosure.Title>
                  <ExceptionHeader type={exc.type} module={exc.module} />
                </Disclosure.Title>
                <Disclosure.Content>
                  <Flex direction="column" gap="sm">
                    <ExceptionDescription
                      value={exc.value}
                      mechanism={exc.mechanism}
                      gap="lg"
                    />
                    {idx === 0 ? (
                      <ErrorBoundary customComponent={null}>
                        <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
                      </ErrorBoundary>
                    ) : null}
                    <StackTraceProvider
                      event={event}
                      stacktrace={exc.stacktrace}
                      frameSourceMapDebuggerData={exc.debuggerData}
                    >
                      <StackTraceFrames
                        frameContextComponent={IssueStackTraceFrameContext}
                      />
                    </StackTraceProvider>
                  </Flex>
                </Disclosure.Content>
              </Disclosure>
            ))}
            <IssueStackTraceLineCoverageLegend />
          </Flex>
        </InterimSection>
      </StackTraceViewStateProvider>
    </LineCoverageProvider>
  );
}
