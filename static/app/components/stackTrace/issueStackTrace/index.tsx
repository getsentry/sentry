import {useCallback, useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {analyzeFrameForRootCause} from 'sentry/components/events/interfaces/analyzeFrames';
import rawStacktraceContent from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {getThreadById} from 'sentry/components/events/interfaces/utils';
import {ExceptionHeader} from 'sentry/components/stackTrace/exceptionHeader';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {CopyButton, DisplayOptions} from 'sentry/components/stackTrace/toolbar';
import type {FrameBadge} from 'sentry/components/stackTrace/types';
import {t, tn} from 'sentry/locale';
import type {Event, ExceptionValue, Frame} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {IssueStackTraceFrameContext} from './issueStackTraceFrameContext';

interface IssueStackTraceProps {
  event: Event;
  values: ExceptionValue[];
  lockAddress?: string;
  newestFirst?: boolean;
  threadId?: number;
}

export function IssueStackTrace({
  event,
  lockAddress,
  newestFirst = true,
  threadId,
  values,
}: IssueStackTraceProps) {
  const mechanism =
    event.platform === 'java' && event.tags?.find(tag => tag.key === 'mechanism')?.value;

  const orderedWithStacktrace = useMemo(() => {
    const withStacktrace = values.filter(exc => exc.stacktrace !== null);
    return newestFirst ? withStacktrace.toReversed() : withStacktrace;
  }, [newestFirst, values]);

  const anrFrameBadge = useCallback<FrameBadge>(
    (frame: Frame) => {
      const culprit = analyzeFrameForRootCause(
        frame,
        getThreadById(event, threadId),
        lockAddress
      );
      if (!culprit) {
        return null;
      }

      return (
        <Tag
          variant="warning"
          onClick={mouseEvent => {
            mouseEvent.stopPropagation();
            document
              .getElementById(SectionKey.SUSPECT_ROOT_CAUSE)
              ?.scrollIntoView({block: 'start', behavior: 'smooth'});
          }}
        >
          {t('Suspect Frame')}
        </Tag>
      );
    },
    [event, lockAddress, threadId]
  );

  const isANR = mechanism === 'ANR' || mechanism === 'AppExitInfo';
  const frameBadge = isANR ? anrFrameBadge : undefined;

  if (orderedWithStacktrace.length === 0) {
    return null;
  }

  if (orderedWithStacktrace.length === 1) {
    const actions = (
      <Flex align="center" gap="sm">
        <DisplayOptions />
        <CopyButton />
      </Flex>
    );
    const exc = orderedWithStacktrace[0]!;
    return (
      <StackTraceViewStateProvider
        defaultIsNewestFirst={newestFirst}
        platform={event.platform}
      >
        <StackTraceProvider
          event={event}
          frameBadge={frameBadge}
          stacktrace={exc.stacktrace!}
        >
          <InterimSection
            type={SectionKey.EXCEPTION}
            title="Stack Trace"
            actions={actions}
          >
            <ExceptionHeader
              type={exc.type}
              value={exc.value}
              module={exc.module}
              mechanism={exc.mechanism}
            />
            <StackTraceFrames frameContextComponent={IssueStackTraceFrameContext} />
          </InterimSection>
        </StackTraceProvider>
      </StackTraceViewStateProvider>
    );
  }

  return (
    <StackTraceViewStateProvider
      defaultIsNewestFirst={newestFirst}
      platform={event.platform}
    >
      <InterimSection
        type={SectionKey.EXCEPTION}
        title="Stack Trace"
        actions={
          <Flex align="center" gap="sm">
            <DisplayOptions />
            <CopyButton
              getCopyText={() =>
                orderedWithStacktrace
                  .map(exc =>
                    rawStacktraceContent({
                      data: exc.stacktrace!,
                      platform: event.platform,
                    })
                  )
                  .join('\n\n')
              }
            />
          </Flex>
        }
      >
        <Text variant="muted">
          {tn(
            'There is %s chained exception in this event.',
            'There are %s chained exceptions in this event.',
            orderedWithStacktrace.length
          )}
        </Text>
        <Flex direction="column" gap="sm">
          {orderedWithStacktrace.map((exc, idx) => (
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
                  <StackTraceProvider
                    event={event}
                    frameBadge={frameBadge}
                    stacktrace={exc.stacktrace!}
                  >
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
