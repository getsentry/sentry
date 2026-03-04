import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';

import type {Event, ExceptionValue} from 'sentry/types/event';

import {ExceptionHeader} from './exceptionHeader';
import {StackTraceProvider, StackTraceSharedViewProvider} from './stackTraceProvider';

interface ChainedStackTraceProps {
  event: Event;
  values: ExceptionValue[];
  newestFirst?: boolean;
}

export function ChainedStackTrace({
  event,
  values,
  newestFirst = true,
}: ChainedStackTraceProps) {
  const filtered = values.filter(exc => exc.stacktrace !== null);
  const ordered = newestFirst ? [...filtered].reverse() : filtered;

  return (
    <StackTraceSharedViewProvider>
      <StackTraceSharedViewProvider.Toolbar />
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
    </StackTraceSharedViewProvider>
  );
}
