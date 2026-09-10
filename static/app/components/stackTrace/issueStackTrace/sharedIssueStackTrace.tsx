import {Flex} from '@sentry/scraps/layout';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {IssueExceptionStackTrace} from 'sentry/components/stackTrace/issueStackTrace/exceptionStackTrace';
import {NativeDisplayOptionsMenu} from 'sentry/components/stackTrace/native/nativeDisplayOptions';
import {NativeStackTraceViewStateProvider} from 'sentry/components/stackTrace/native/nativeDisplayOptionsContext';
import {getNativeFrameCapabilities} from 'sentry/components/stackTrace/native/nativeFrameAnalysis';
import {useStackTraceViewState} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrameList} from 'sentry/components/stackTrace/stackTraceFrameList';
import type {Event, ExceptionValue} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {isNativePlatform} from 'sentry/utils/platform';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {formatExceptionsAsText, getOrderedExceptions} from './utils';

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

/** Public issue renderer: uses only event data, without authenticated actions or requests. */
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
    <NativeStackTraceViewStateProvider
      platform={getStacktracePlatform(
        event,
        values.find(value => value.stacktrace)?.stacktrace
      )}
      hasMinifiedStacktrace={hasMinifiedStacktrace}
      defaultView={
        values.some(value => value.stacktrace?.hasSystemFrames) ? 'app' : 'full'
      }
    >
      <SharedIssueStackTraceContent
        event={event}
        values={values}
        isStandalone={isStandalone}
      />
    </NativeStackTraceViewStateProvider>
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
  const {isMinified, isNewestFirst, view, platform} = useStackTraceViewState();
  const exceptions = getOrderedExceptions(values, isNewestFirst, view);
  if (!exceptions.length) {
    return null;
  }
  const frames = values.flatMap(
    value =>
      (isMinified ? (value.rawStacktrace ?? value.stacktrace) : value.stacktrace)
        ?.frames ?? []
  );
  const isNative =
    isNativePlatform(platform) ||
    values.some(value =>
      isNativePlatform(getStacktracePlatform(event, value.stacktrace))
    );

  return (
    <FoldSection
      sectionKey={isStandalone ? SectionKey.STACKTRACE : SectionKey.EXCEPTION}
      title="Stack Trace"
      actions={
        <Flex align="center" gap="sm">
          {isNative ? (
            <NativeDisplayOptionsMenu {...getNativeFrameCapabilities(frames)} />
          ) : (
            <DisplayOptions />
          )}
          <CopyAsDropdown
            size="xs"
            items={CopyAsDropdown.makeDefaultCopyAsOptions({
              text: () =>
                formatExceptionsAsText({
                  exceptions,
                  platform: event.platform,
                  isMinified,
                  isStandalone,
                }),
              json: undefined,
              markdown: undefined,
            })}
          />
        </Flex>
      }
    >
      <IssueExceptionStackTrace
        event={event}
        values={values}
        isStandalone={isStandalone}
        showBanners={false}
        frameListComponent={StackTraceFrameList}
      />
    </FoldSection>
  );
}
