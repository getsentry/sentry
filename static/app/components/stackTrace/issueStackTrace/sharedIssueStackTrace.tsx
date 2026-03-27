import {useMemo} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {displayRawContent as rawStacktraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace/rawContent';
import {Panel} from 'sentry/components/panels/panel';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {
  RelatedExceptionsTree,
  ToggleRelatedExceptionsButton,
  useHiddenExceptions,
} from 'sentry/components/stackTrace/exceptionGroup';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {RawStackTraceText} from 'sentry/components/stackTrace/rawStackTrace';
import {
  StackTraceViewStateProvider,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {tn} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface SharedIssueStackTraceBaseProps {
  event: Event;
}

interface SharedExceptionStackTraceProps extends SharedIssueStackTraceBaseProps {
  values: ExceptionValue[];
  stacktrace?: never;
}

interface SharedStandaloneStackTraceProps extends SharedIssueStackTraceBaseProps {
  stacktrace: StacktraceType;
  values?: never;
}

type SharedIssueStackTraceProps =
  | SharedExceptionStackTraceProps
  | SharedStandaloneStackTraceProps;

interface IndexedExceptionValue extends ExceptionValue {
  exceptionIndex: number;
  stacktrace: StacktraceType;
}

function resolveExceptionFields(exc: IndexedExceptionValue, isMinified: boolean) {
  return {
    type: isMinified ? (exc.rawType ?? exc.type) : exc.type,
    module: isMinified ? (exc.rawModule ?? exc.module) : exc.module,
    value: isMinified ? (exc.rawValue ?? exc.value) : exc.value,
  };
}

/**
 * Stack trace component for the shared issue page.
 *
 * Renders the full exception experience (headers, chaining, display options,
 * raw view, copy-as) without making any authenticated API requests.
 *
 * The shared issue page is viewed by unauthenticated users, so this component
 * intentionally avoids the following from {@link IssueStackTrace}:
 * - {@link IssueFrameActions}: calls stacktrace-link and source-map-debug APIs
 * - {@link IssueStackTraceFrameContext}: calls stacktrace-coverage API (Codecov)
 * - {@link StacktraceBanners}: depends on authenticated project context
 * - {@link SuspectCommits}: requires group and project data
 * - {@link LineCoverageProvider}: no coverage data without auth
 *
 * Uses {@link DefaultFrameActions} and {@link FrameContent} instead, which
 * render entirely from local event data.
 */
export function SharedIssueStackTrace(props: SharedIssueStackTraceProps) {
  const {event} = props;
  const eventHasThreads = event.entries?.some(entry => entry.type === EntryType.THREADS);
  if (eventHasThreads) {
    return null;
  }

  const isStandalone = 'stacktrace' in props && !!props.stacktrace;

  let values: ExceptionValue[];
  if (isStandalone) {
    if (!(props.stacktrace.frames ?? []).length) {
      return null;
    }
    values = [
      {
        stacktrace: props.stacktrace,
        type: '',
        value: null,
        module: null,
        mechanism: null,
        threadId: null,
        rawStacktrace: null,
      },
    ];
  } else {
    values = props.values;
  }

  const hasMinifiedStacktrace =
    !isStandalone && values.some(v => v.rawStacktrace !== null);

  return (
    <StackTraceViewStateProvider
      platform={event.platform}
      hasMinifiedStacktrace={hasMinifiedStacktrace}
    >
      <SharedIssueStackTraceContent
        event={event}
        values={values}
        isStandalone={isStandalone}
      />
    </StackTraceViewStateProvider>
  );
}

function SharedIssueStackTraceContent({
  event,
  values,
  isStandalone,
}: {
  event: Event;
  isStandalone: boolean;
  values: ExceptionValue[];
}) {
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);

  const entryType = isStandalone ? EntryType.STACKTRACE : EntryType.EXCEPTION;
  const entryIndex = event.entries?.findIndex(entry => entry.type === entryType);
  const rawEntryMeta = event._meta?.entries?.[entryIndex ?? -1]?.data;
  const exceptionValuesMeta = isStandalone ? undefined : rawEntryMeta?.values;

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

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () =>
      exceptions
        .map(exc =>
          rawStacktraceContent({
            data: isMinified ? (exc.rawStacktrace ?? exc.stacktrace) : exc.stacktrace,
            platform: event.platform,
          })
        )
        .join('\n\n'),
    json: undefined,
    markdown: undefined,
  });

  const sectionKey = isStandalone ? SectionKey.STACKTRACE : SectionKey.EXCEPTION;

  const sectionActions = (
    <Flex align="center" gap="sm">
      <DisplayOptions />
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );

  if (view === 'raw') {
    return (
      <InterimSection type={sectionKey} title="Stack Trace" actions={sectionActions}>
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
      </InterimSection>
    );
  }

  if (exceptions.length === 1) {
    const exc = exceptions[0]!;
    const {type, module, value} = resolveExceptionFields(exc, isMinified);
    const hasExceptionInfo = Boolean(type || value);
    const excMeta = exceptionValuesMeta?.[exc.exceptionIndex];

    return (
      <InterimSection type={sectionKey} title="Stack Trace" actions={sectionActions}>
        {hasExceptionInfo && (
          <Flex direction="column" gap="sm">
            <div>
              <ExceptionHeader type={type} module={module} />
            </div>
            <ExceptionDescription
              value={value}
              mechanism={exc.mechanism}
              meta={excMeta}
            />
          </Flex>
        )}
        <StackTraceProvider
          exceptionIndex={isStandalone ? undefined : exc.exceptionIndex}
          event={event}
          stacktrace={exc.stacktrace}
          minifiedStacktrace={exc.rawStacktrace ?? undefined}
          meta={isStandalone ? rawEntryMeta : excMeta?.stacktrace}
        >
          <StackTraceFrames frameContextComponent={FrameContent} />
        </StackTraceProvider>
      </InterimSection>
    );
  }

  return (
    <InterimSection type={sectionKey} title="Stack Trace" actions={sectionActions}>
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
          const {
            type: excType,
            module: excModule,
            value: excValue,
          } = resolveExceptionFields(exc, isMinified);

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
                    meta={exceptionValuesMeta?.[exc.exceptionIndex]}
                    gap="lg"
                  />
                  <RelatedExceptionsTree
                    exception={exc}
                    allExceptions={values}
                    newestFirst={isNewestFirst}
                    onExceptionClick={expandException}
                  />
                  <StackTraceProvider
                    exceptionIndex={exc.exceptionIndex}
                    event={event}
                    stacktrace={exc.stacktrace}
                    minifiedStacktrace={exc.rawStacktrace ?? undefined}
                    meta={exceptionValuesMeta?.[exc.exceptionIndex]?.stacktrace}
                  >
                    <StackTraceFrames frameContextComponent={FrameContent} />
                  </StackTraceProvider>
                </Flex>
              </Disclosure.Content>
            </Disclosure>
          );
        })}
      </Flex>
    </InterimSection>
  );
}
