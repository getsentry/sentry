import {useEffect, useMemo} from 'react';
import type {Dispatch, SetStateAction} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {Panel} from 'sentry/components/panels/panel';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {IssueExceptionStackTrace} from 'sentry/components/stackTrace/issueStackTrace/exceptionStackTrace';
import {RawStackTraceText} from 'sentry/components/stackTrace/rawStackTrace';
import {
  StackTraceViewStateProvider,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils/defined';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {formatExceptionsAsText, getOrderedExceptions} from './utils';

interface IssueStackTraceBaseProps {
  event: Event;
  group?: Group;
  projectSlug?: Project['slug'];
}

/** Exception stack traces with chaining, type/value metadata, and minified variants. */
interface ExceptionStackTraceProps extends IssueStackTraceBaseProps {
  values: ExceptionValue[];
  stacktrace?: never;
}

/** Bare stack trace with no exception metadata (e.g. log/message events). */
interface StandaloneStackTraceProps extends IssueStackTraceBaseProps {
  stacktrace: StacktraceType;
  values?: never;
}

type IssueStackTraceProps = ExceptionStackTraceProps | StandaloneStackTraceProps;

type PersistedDisplayOption = 'raw-stack-trace' | 'minified';

const NO_PERSIST_KEY = '__no_persist_stacktrace_display__';

export function IssueStackTrace(props: IssueStackTraceProps) {
  const {event, group, projectSlug} = props;
  const organization = useOrganization();
  const storageKey = projectSlug
    ? `issue-details-stracktrace-display-${organization.slug}-${projectSlug}`
    : NO_PERSIST_KEY;
  const [persistedOptions, setPersistedOptions] = useLocalStorageState<
    PersistedDisplayOption[]
  >(storageKey, []);

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
      defaultView={
        projectSlug && persistedOptions.includes('raw-stack-trace') ? 'raw' : 'app'
      }
      defaultIsMinified={!!projectSlug && persistedOptions.includes('minified')}
    >
      {projectSlug && <PersistDisplayOptions setPersistedOptions={setPersistedOptions} />}
      <IssueStackTraceContent
        // Reset internal state when switching events
        key={event.id}
        event={event}
        values={values}
        group={group}
        projectSlug={projectSlug}
        isStandalone={isStandalone}
      />
    </StackTraceViewStateProvider>
  );
}

function PersistDisplayOptions({
  setPersistedOptions,
}: {
  setPersistedOptions: Dispatch<SetStateAction<PersistedDisplayOption[]>>;
}) {
  const {view, isMinified, hasMinifiedStacktrace} = useStackTraceViewState();
  useEffect(() => {
    setPersistedOptions(previousOptions => {
      const next: PersistedDisplayOption[] = [];
      if (view === 'raw') {
        next.push('raw-stack-trace');
      }
      if (
        isMinified ||
        (!hasMinifiedStacktrace && previousOptions.includes('minified'))
      ) {
        next.push('minified');
      }
      return next;
    });
  }, [view, isMinified, hasMinifiedStacktrace, setPersistedOptions]);
  return null;
}

function IssueStackTraceContent({
  event,
  values,
  group,
  projectSlug,
  isStandalone,
}: IssueStackTraceBaseProps & {isStandalone: boolean; values: ExceptionValue[]}) {
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const organization = useOrganization();
  const {data: detailedProject} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug: projectSlug ?? ''},
    {enabled: defined(projectSlug)}
  );
  const hasScmSourceContext = !!detailedProject?.scmSourceContextEnabled;
  const exceptions = useMemo(
    () => getOrderedExceptions(values, isNewestFirst, view),
    [values, isNewestFirst, view]
  );

  if (exceptions.length === 0) {
    return null;
  }

  const sectionKey = isStandalone ? SectionKey.STACKTRACE : SectionKey.EXCEPTION;

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () =>
      formatExceptionsAsText({
        exceptions,
        platform: event.platform,
        isMinified,
        isStandalone,
      }),
    json: undefined,
    markdown: undefined,
  });

  const sectionActions = (
    <Flex align="center" gap="sm">
      <DisplayOptions />
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );

  if (view === 'raw') {
    return (
      <FoldSection sectionKey={sectionKey} title="Stack Trace" actions={sectionActions}>
        <Stack gap="lg">
          <Panel>
            <RawStackTraceText>
              {formatExceptionsAsText({
                exceptions,
                platform: event.platform,
                isMinified,
                isStandalone,
              })}
            </RawStackTraceText>
          </Panel>
          <IssueStackTraceSuspectCommits
            event={event}
            group={group}
            projectSlug={projectSlug}
          />
        </Stack>
      </FoldSection>
    );
  }

  return (
    <FoldSection sectionKey={sectionKey} title="Stack Trace" actions={sectionActions}>
      <Stack gap="lg">
        <IssueExceptionStackTrace
          event={event}
          hasScmSourceContext={hasScmSourceContext}
          isStandalone={isStandalone}
          values={values}
        />
        <IssueStackTraceSuspectCommits
          event={event}
          group={group}
          projectSlug={projectSlug}
        />
      </Stack>
    </FoldSection>
  );
}

function IssueStackTraceSuspectCommits({
  event,
  group,
  projectSlug,
}: IssueStackTraceBaseProps) {
  if (!group || !projectSlug) {
    return null;
  }

  return (
    <ErrorBoundary mini message={t('There was an error loading suspect commits')}>
      <SuspectCommits projectSlug={projectSlug} eventId={event.id} group={group} />
    </ErrorBoundary>
  );
}
