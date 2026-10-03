import {useMemo} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import {Panel} from 'sentry/components/panels/panel';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {IssueExceptionStackTrace} from 'sentry/components/stackTrace/issueStackTrace/exceptionStackTrace';
import {supportsAppleCrashReport} from 'sentry/components/stackTrace/native/appleCrashReport';
import {NativeAppleCrashReportContent} from 'sentry/components/stackTrace/native/nativeAppleCrashReportContent';
import {NativeDisplayOptionsMenu} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {NativeStackTraceViewStateProvider} from 'sentry/components/stackTrace/native/nativeDisplayOptionsContext';
import {getNativeFrameCapabilities} from 'sentry/components/stackTrace/native/nativeFrameAnalysis';
import {RawDownloadAction} from 'sentry/components/stackTrace/native/rawDownloadAction';
import {RawStackTraceText} from 'sentry/components/stackTrace/rawStackTrace';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {t} from 'sentry/locale';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils/defined';
import {isNativePlatform} from 'sentry/utils/platform';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {formatExceptionsAsText, getOrderedExceptions} from './utils';

interface IssueStackTraceBaseProps {
  event: Event;
  group?: Group;
  groupingCurrentLevel?: Group['metadata']['current_level'];
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

export function IssueStackTrace(props: IssueStackTraceProps) {
  const {
    event,
    group,
    projectSlug,
    groupingCurrentLevel = group?.metadata.current_level,
  } = props;
  const organization = useOrganization();
  const storageKey = projectSlug
    ? `issue-details-stracktrace-display-${organization.slug}-${projectSlug}`
    : undefined;

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

  const platform = getStacktracePlatform(
    event,
    values.find(value => value.stacktrace)?.stacktrace
  );
  const isNative =
    isNativePlatform(platform) ||
    values.some(value =>
      isNativePlatform(getStacktracePlatform(event, value.stacktrace))
    );
  const content = (
    <IssueStackTraceContent
      key={event.id}
      event={event}
      values={values}
      group={group}
      groupingCurrentLevel={groupingCurrentLevel}
      projectSlug={projectSlug}
      isStandalone={isStandalone}
      isNative={isNative}
    />
  );

  return (
    <NativeStackTraceViewStateProvider
      key={event.id}
      platform={platform}
      storageKey={storageKey}
      hasMinifiedStacktrace={hasMinifiedStacktrace}
      defaultView={
        isNative && !values.some(value => value.stacktrace?.hasSystemFrames)
          ? 'full'
          : 'app'
      }
    >
      {content}
    </NativeStackTraceViewStateProvider>
  );
}

function IssueStackTraceContent({
  event,
  values,
  group,
  projectSlug,
  isStandalone,
  isNative,
  groupingCurrentLevel,
}: IssueStackTraceBaseProps & {
  isNative: boolean;
  isStandalone: boolean;
  values: ExceptionValue[];
}) {
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
      {isNative && projectSlug ? (
        <RawDownloadAction
          eventId={event.id}
          organization={organization}
          platform={event.platform}
          projectSlug={projectSlug}
        />
      ) : null}
      {isNative ? (
        <NativeDisplayOptionsMenu
          {...getNativeFrameCapabilities(
            values.flatMap(
              value =>
                (isMinified
                  ? (value.rawStacktrace ?? value.stacktrace)
                  : value.stacktrace
                )?.frames ?? []
            )
          )}
        />
      ) : (
        <DisplayOptions />
      )}
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );

  if (view === 'raw') {
    return (
      <FoldSection sectionKey={sectionKey} title="Stack Trace" actions={sectionActions}>
        <Stack gap="lg">
          {isNative &&
          !isStandalone &&
          projectSlug &&
          supportsAppleCrashReport(event.platform) ? (
            <NativeAppleCrashReportContent eventId={event.id} projectSlug={projectSlug} />
          ) : (
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
          )}
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
          groupingCurrentLevel={groupingCurrentLevel}
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
