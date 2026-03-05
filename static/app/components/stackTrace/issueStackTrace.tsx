import {useMemo, useState} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {tn} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {ExceptionHeader} from './exceptionHeader';
import {
  StackTraceSharedViewContext,
  type StackTraceSharedViewContextValue,
} from './stackTraceContext';
import {StackTraceProvider} from './stackTraceProvider';
import {CopyButton, DisplayOptions} from './toolbar';
import type {StackTraceView} from './types';

interface SharedViewRootProps {
  children: React.ReactNode;
  defaultIsNewestFirst?: boolean;
}

function SharedViewRoot({children, defaultIsNewestFirst = true}: SharedViewRootProps) {
  const [view, setView] = useState<StackTraceView>('app');
  const [isNewestFirst, setIsNewestFirst] = useState(defaultIsNewestFirst);
  const [isMinified, setIsMinified] = useState(false);

  const value = useMemo<StackTraceSharedViewContextValue>(
    () => ({
      hasMinifiedStacktrace: false,
      isMinified,
      isNewestFirst,
      setIsMinified,
      setIsNewestFirst,
      setView,
      view,
    }),
    [isMinified, isNewestFirst, view]
  );

  return (
    <StackTraceSharedViewContext.Provider value={value}>
      {children}
    </StackTraceSharedViewContext.Provider>
  );
}

interface IssueStackTraceProps {
  event: Event;
  values: ExceptionValue[];
  newestFirst?: boolean;
}

export function IssueStackTrace({
  event,
  values,
  newestFirst = true,
}: IssueStackTraceProps) {
  const withStacktrace = values.filter(exc => exc.stacktrace !== null);

  if (withStacktrace.length === 0) {
    return null;
  }

  const actions = (
    <Flex align="center" gap="sm">
      <DisplayOptions />
      <CopyButton />
    </Flex>
  );

  if (withStacktrace.length === 1) {
    const exc = withStacktrace[0]!;
    return (
      <StackTraceProvider
        event={event}
        stacktrace={exc.stacktrace!}
        defaultIsNewestFirst={newestFirst}
      >
        <InterimSection type={SectionKey.EXCEPTION} title="Stack Trace" actions={actions}>
          <ExceptionHeader
            type={exc.type}
            value={exc.value}
            module={exc.module}
            mechanism={exc.mechanism}
          />
          <StackTraceProvider.Frames />
        </InterimSection>
      </StackTraceProvider>
    );
  }

  const ordered = newestFirst ? [...withStacktrace].reverse() : withStacktrace;

  const chainedActions = (
    <Flex align="center" gap="sm">
      <DisplayOptions />
      <CopyButton
        getCopyText={() =>
          ordered
            .map(exc =>
              rawStacktraceContent({data: exc.stacktrace!, platform: event.platform})
            )
            .join('\n\n')
        }
      />
    </Flex>
  );

  return (
    <SharedViewRoot defaultIsNewestFirst={newestFirst}>
      <InterimSection
        type={SectionKey.EXCEPTION}
        title="Stack Trace"
        actions={chainedActions}
      >
        <Text variant="muted">
          {tn(
            'There is %s chained exception in this event.',
            'There are %s chained exceptions in this event.',
            ordered.length
          )}
        </Text>
        <Flex direction="column" gap="sm">
          {ordered.map((exc, idx) => (
            <Disclosure
              key={exc.mechanism?.exception_id ?? idx}
              defaultExpanded={idx === 0}
            >
              <Disclosure.Title>
                {exc.type}: {exc.value}
              </Disclosure.Title>
              <Disclosure.Content>
                <Flex direction="column" gap="md">
                  <ExceptionHeader
                    type={exc.type}
                    value={exc.value}
                    module={exc.module}
                    mechanism={exc.mechanism}
                  />
                  <StackTraceProvider event={event} stacktrace={exc.stacktrace!}>
                    <StackTraceProvider.Frames />
                  </StackTraceProvider>
                </Flex>
              </Disclosure.Content>
            </Disclosure>
          ))}
        </Flex>
      </InterimSection>
    </SharedViewRoot>
  );
}
