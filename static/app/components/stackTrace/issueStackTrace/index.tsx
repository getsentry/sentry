import {useMemo} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
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
import type {StacktraceType} from 'sentry/types/stacktrace';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {IssueStackTraceFrameContext} from './issueStackTraceFrameContext';

interface IssueStackTraceProps {
  event: Event;
  values: ExceptionValue[];
  newestFirst?: boolean;
}

export function IssueStackTrace({event, values}: IssueStackTraceProps) {
  const withStacktrace = useMemo(() => {
    return values
      .filter(
        (exc): exc is ExceptionValue & {stacktrace: StacktraceType} =>
          exc.stacktrace !== null
      )
      .reverse();
  }, [values]);

  if (withStacktrace.length === 0) {
    return null;
  }

  if (withStacktrace.length === 1) {
    const actions = (
      <Flex align="center" gap="sm">
        <DisplayOptions />
        <CopyButton />
      </Flex>
    );
    const exc = withStacktrace[0]!;
    return (
      <StackTraceViewStateProvider platform={event.platform}>
        <StackTraceProvider event={event} stacktrace={exc.stacktrace}>
          <InterimSection
            type={SectionKey.EXCEPTION}
            title="Stack Trace"
            actions={actions}
          >
            <Flex direction="column" gap="sm">
              <ExceptionHeader type={exc.type} module={exc.module} />
              <ExceptionDescription value={exc.value} mechanism={exc.mechanism} />
            </Flex>
            <StackTraceFrames frameContextComponent={IssueStackTraceFrameContext} />
          </InterimSection>
        </StackTraceProvider>
      </StackTraceViewStateProvider>
    );
  }

  return (
    <StackTraceViewStateProvider platform={event.platform}>
      <InterimSection
        type={SectionKey.EXCEPTION}
        title="Stack Trace"
        actions={
          <Flex align="center" gap="sm">
            <DisplayOptions />
            <CopyButton
              getCopyText={() =>
                withStacktrace
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
        <Flex direction="column" gap="sm">
          <Text variant="muted">
            {tn(
              'There is %s chained exception in this event.',
              'There are %s chained exceptions in this event.',
              withStacktrace.length
            )}
          </Text>
          <Separator orientation="horizontal" border="primary" />
          {withStacktrace.map((exc, idx) => (
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
                  <StackTraceProvider event={event} stacktrace={exc.stacktrace}>
                    <StackTraceFrames
                      frameContextComponent={IssueStackTraceFrameContext}
                    />
                  </StackTraceProvider>
                </Flex>
              </Disclosure.Content>
            </Disclosure>
          ))}
        </Flex>
      </InterimSection>
    </StackTraceViewStateProvider>
  );
}
