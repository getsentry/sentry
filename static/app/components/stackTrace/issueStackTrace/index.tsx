import {Fragment, useEffect, useMemo} from 'react';
import type {ComponentType, Dispatch, ReactNode, SetStateAction} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
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
import {RawStackTraceText} from 'sentry/components/stackTrace/rawStackTrace';
import {
  StackTraceViewStateProvider,
  useStackTraceViewState,
} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {t, tn} from 'sentry/locale';
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

import {IssueFrameActions} from './issueFrameActions';
import {IssueStackTraceFrameContext} from './issueStackTraceFrameContext';
import {
  formatExceptionsAsText,
  getExceptionEntryMeta,
  getOrderedExceptions,
  resolveExceptionFields,
} from './utils';

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

export type IssueStackTraceProps = ExceptionStackTraceProps | StandaloneStackTraceProps;

type PersistedDisplayOption = 'raw-stack-trace' | 'minified';

const NO_PERSIST_KEY = '__no_persist_stacktrace_display__';

export function IssueStackTrace(props: IssueStackTraceProps) {
  return (
    <IssueStackTraceViewStateProvider {...props}>
      <IssueStackTraceSection key={props.event.id} {...props} />
    </IssueStackTraceViewStateProvider>
  );
}

function IssueStackTraceViewStateProvider({
  children,
  ...props
}: IssueStackTraceProps & {children: ReactNode}) {
  const {event, projectSlug} = props;
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

  if (isStandalone && !(props.stacktrace.frames ?? []).length) {
    return null;
  }
  const values = getExceptionValues(props);
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
      {children}
    </StackTraceViewStateProvider>
  );
}

function getExceptionValues(
  props: Pick<IssueStackTraceProps, 'stacktrace' | 'values'>
): ExceptionValue[] {
  if (props.stacktrace) {
    return [
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
  }
  return props.values ?? [];
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

function useIssueStackTrace(props: IssueStackTraceProps) {
  const {event, group, projectSlug, stacktrace, values: exceptionValues} = props;
  const isStandalone = !!stacktrace;
  const values = useMemo(
    () => getExceptionValues({stacktrace, values: exceptionValues}),
    [stacktrace, exceptionValues]
  );
  const {isMinified, isNewestFirst, view} = useStackTraceViewState();
  const organization = useOrganization();
  const {data: detailedProject} = useDetailedProject(
    {orgSlug: organization.slug, projectSlug: projectSlug ?? ''},
    {enabled: defined(projectSlug)}
  );
  const hasScmSourceContext = !!detailedProject?.scmSourceContextEnabled;
  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);

  const {rawEntryMeta, exceptionValuesMeta} = getExceptionEntryMeta(event, isStandalone);

  const exceptions = useMemo(
    () => getOrderedExceptions(values, isNewestFirst, view),
    [values, isNewestFirst, view]
  );

  const firstVisibleExceptionIndex = exceptions.findIndex(
    exc =>
      exc.mechanism?.parent_id === undefined || !hiddenExceptions[exc.mechanism.parent_id]
  );

  return {
    event,
    group,
    projectSlug,
    isStandalone,
    values,
    view,
    isMinified,
    isNewestFirst,
    exceptions,
    rawEntryMeta,
    exceptionValuesMeta,
    hasScmSourceContext,
    hiddenExceptions,
    toggleRelatedExceptions,
    expandException,
    firstVisibleExceptionIndex,
  };
}

type IssueStackTraceData = ReturnType<typeof useIssueStackTrace>;

function IssueStackTraceSection(props: IssueStackTraceProps) {
  const trace = useIssueStackTrace(props);
  if (!trace.exceptions.length) {
    return null;
  }
  return (
    <FoldSection
      sectionKey={trace.isStandalone ? SectionKey.STACKTRACE : SectionKey.EXCEPTION}
      title="Stack Trace"
      actions={<IssueStackTraceActions trace={trace} />}
    >
      <IssueStackTraceContent trace={trace} />
    </FoldSection>
  );
}

function IssueStackTraceActions({trace}: {trace: IssueStackTraceData}) {
  const {event, exceptions, isMinified, isStandalone} = trace;
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

  return (
    <Flex align="center" gap="sm">
      <DisplayOptions />
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );
}

function IssueStackTraceContent({
  trace,
  collapseAll = false,
  frameActionsComponent = IssueFrameActions,
}: {
  trace: IssueStackTraceData;
  collapseAll?: boolean;
  frameActionsComponent?: ComponentType<{isHovering: boolean}>;
}) {
  const {
    event,
    group,
    projectSlug,
    values,
    isStandalone,
    view,
    isMinified,
    isNewestFirst,
    exceptions,
    rawEntryMeta,
    exceptionValuesMeta,
    hasScmSourceContext,
    hiddenExceptions,
    toggleRelatedExceptions,
    expandException,
    firstVisibleExceptionIndex,
  } = trace;

  if (view === 'raw') {
    return (
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
    );
  }

  if (exceptions.length === 1) {
    const exc = exceptions[0]!;
    const {type, module, value} = resolveExceptionFields(exc, isMinified);
    const hasExceptionInfo = Boolean(type || value);

    const excMeta = exceptionValuesMeta?.[exc.exceptionIndex];

    return (
      <Stack gap="lg">
        <Stack gap="sm">
          {hasExceptionInfo && (
            <Fragment>
              <div>
                <ExceptionHeader type={type} module={module} />
              </div>
              <ExceptionDescription
                value={value}
                mechanism={exc.mechanism}
                meta={excMeta}
              />
            </Fragment>
          )}
        </Stack>
        {exc.stacktrace && (
          <ErrorBoundary customComponent={null}>
            <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
          </ErrorBoundary>
        )}
        <StackTraceProvider
          collapseAll={collapseAll}
          exceptionIndex={isStandalone ? undefined : exc.exceptionIndex}
          event={event}
          hasScmSourceContext={hasScmSourceContext}
          stacktrace={exc.stacktrace}
          minifiedStacktrace={exc.rawStacktrace ?? undefined}
          meta={isStandalone ? rawEntryMeta : excMeta?.stacktrace}
        >
          <StackTraceFrames
            frameContextComponent={IssueStackTraceFrameContext}
            frameActionsComponent={frameActionsComponent}
          />
        </StackTraceProvider>
        <IssueStackTraceSuspectCommits
          event={event}
          group={group}
          projectSlug={projectSlug}
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
              <Stack gap="sm">
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
                {exc.stacktrace && idx === firstVisibleExceptionIndex ? (
                  <ErrorBoundary customComponent={null}>
                    <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
                  </ErrorBoundary>
                ) : null}
                <StackTraceProvider
                  collapseAll={collapseAll}
                  exceptionIndex={exc.exceptionIndex}
                  event={event}
                  hasScmSourceContext={hasScmSourceContext}
                  stacktrace={exc.stacktrace}
                  minifiedStacktrace={exc.rawStacktrace ?? undefined}
                  meta={exceptionValuesMeta?.[exc.exceptionIndex]?.stacktrace}
                >
                  <StackTraceFrames
                    frameContextComponent={IssueStackTraceFrameContext}
                    frameActionsComponent={frameActionsComponent}
                  />
                </StackTraceProvider>
              </Stack>
            </Disclosure.Content>
          </Disclosure>
        );
      })}
      <IssueStackTraceSuspectCommits
        event={event}
        group={group}
        projectSlug={projectSlug}
      />
    </Stack>
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
