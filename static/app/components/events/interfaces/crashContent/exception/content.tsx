import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {
  prepareSourceMapDebuggerFrameInformation,
  useSourceMapDebuggerData,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {renderLinksInText} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {Tooltip} from 'sentry/components/tooltip';
import {tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, ExceptionType, ExceptionValue} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {StackType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';

import {Mechanism} from './mechanism';
import {RelatedExceptions} from './relatedExceptions';
import StackTrace from './stackTrace';

type StackTraceProps = React.ComponentProps<typeof StackTrace>;

type Props = {
  event: Event;
  projectSlug: Project['slug'];
  type: StackType;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  stackView?: StackTraceProps['stackView'];
  threadId?: number;
} & Pick<ExceptionType, 'values'> &
  Pick<React.ComponentProps<typeof StackTrace>, 'groupingCurrentLevel'>;

type CollapsedExceptionMap = {[exceptionId: number]: boolean};

const useCollapsedExceptions = (values?: ExceptionValue[]) => {
  const [collapsedExceptions, setCollapsedSections] = useState<CollapsedExceptionMap>(
    () => {
      if (!values) {
        return {};
      }

      return values
        .filter(
          ({mechanism}) => mechanism?.is_exception_group && defined(mechanism.parent_id)
        )
        .reduce(
          (acc, next) => ({...acc, [next.mechanism?.exception_id ?? -1]: true}),
          {}
        );
    }
  );

  const toggleException = (exceptionId: number) => {
    setCollapsedSections(old => {
      if (!defined(old[exceptionId])) {
        return old;
      }

      return {...old, [exceptionId]: !old[exceptionId]};
    });
  };

  const expandException = (exceptionId: number) => {
    setCollapsedSections(old => {
      const exceptionValue = values?.find(
        value => value.mechanism?.exception_id === exceptionId
      );
      const exceptionGroupId = exceptionValue?.mechanism?.parent_id;

      if (!exceptionGroupId || !defined(old[exceptionGroupId])) {
        return old;
      }

      return {...old, [exceptionGroupId]: false};
    });
  };

  return {toggleException, collapsedExceptions, expandException};
};

function ToggleExceptionButton({
  values,
  exception,
  toggleException,
  collapsedExceptions,
}: {
  collapsedExceptions: CollapsedExceptionMap;
  exception: ExceptionValue;
  toggleException: (exceptionId: number) => void;
  values: ExceptionValue[];
}) {
  const exceptionId = exception.mechanism?.exception_id;

  if (!exceptionId || !defined(collapsedExceptions[exceptionId])) {
    return null;
  }

  const collapsed = collapsedExceptions[exceptionId];
  const numChildren = values.filter(
    ({mechanism}) => mechanism?.parent_id === exceptionId
  ).length;

  return (
    <ShowRelatedExceptionsButton
      priority="link"
      onClick={() => toggleException(exceptionId)}
    >
      {collapsed
        ? tn('Show %s related exceptions', 'Show %s related exceptions', numChildren)
        : tn('Hide %s related exceptions', 'Hide %s related exceptions', numChildren)}
    </ShowRelatedExceptionsButton>
  );
}

export function Content({
  newestFirst,
  event,
  stackView,
  groupingCurrentLevel,
  projectSlug,
  values,
  type,
  meta,
  threadId,
}: Props) {
  const {collapsedExceptions, toggleException, expandException} =
    useCollapsedExceptions(values);

  const sourceMapDebuggerData = useSourceMapDebuggerData(event, projectSlug);

  const isSampleError = useIsSampleEvent();

  // Organization context may be unavailable for the shared event view, so we
  // avoid using the `useOrganization` hook here and directly useContext
  // instead.
  if (!values) {
    return null;
  }

  const children = values.map((exc, excIdx) => {
    const id = defined(exc.mechanism?.exception_id)
      ? `exception-${exc.mechanism?.exception_id}`
      : undefined;

    const frameSourceMapDebuggerData = sourceMapDebuggerData?.exceptions[
      excIdx
    ]!.frames.map(debuggerFrame =>
      prepareSourceMapDebuggerFrameInformation(
        sourceMapDebuggerData,
        debuggerFrame,
        event
      )
    );
    const exceptionValue = exc.value
      ? renderLinksInText({exceptionText: exc.value})
      : null;

    if (exc.mechanism?.parent_id && collapsedExceptions[exc.mechanism.parent_id]) {
      return null;
    }

    const platform = getStacktracePlatform(event, exc.stacktrace);

    // The banners should appear on the top exception only
    const isTopException = newestFirst ? excIdx === values.length - 1 : excIdx === 0;

    return (
      <div key={excIdx} className="exception" data-test-id="exception-value">
        {defined(exc?.module) ? (
          <Tooltip title={tct('from [exceptionModule]', {exceptionModule: exc?.module})}>
            <Title id={id}>{exc.type}</Title>
          </Tooltip>
        ) : (
          <Title id={id}>{exc.type}</Title>
        )}
        <StyledPre>
          {meta?.[excIdx]?.value?.[''] && !exc.value ? (
            <AnnotatedText value={exc.value} meta={meta?.[excIdx]?.value?.['']} />
          ) : (
            exceptionValue
          )}
        </StyledPre>
        <ToggleExceptionButton
          {...{collapsedExceptions, toggleException, values, exception: exc}}
        />
        {exc.mechanism && (
          <Mechanism data={exc.mechanism} meta={meta?.[excIdx]?.mechanism} />
        )}
        <RelatedExceptions
          mechanism={exc.mechanism}
          allExceptions={values}
          newestFirst={newestFirst}
          onExceptionClick={expandException}
        />
        {exc.stacktrace && isTopException && !isSampleError && (
          <ErrorBoundary customComponent={null}>
            <StacktraceBanners event={event} stacktrace={exc.stacktrace} />
          </ErrorBoundary>
        )}
        <StackTrace
          data={
            type === StackType.ORIGINAL
              ? exc.stacktrace
              : exc.rawStacktrace || exc.stacktrace
          }
          stackView={stackView}
          stacktrace={exc.stacktrace}
          expandFirstFrame={excIdx === values.length - 1}
          platform={platform}
          newestFirst={newestFirst}
          event={event}
          chainedException={values.length > 1}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta?.[excIdx]?.stacktrace}
          threadId={threadId}
          frameSourceMapDebuggerData={frameSourceMapDebuggerData}
          stackType={type}
        />
      </div>
    );
  });

  return <div>{children}</div>;
}

const StyledPre = styled('pre')`
  padding: 0;
  margin: 0;
  word-wrap: break-word;
  white-space: pre-wrap;
  background-color: inherit;
`;

const Title = styled('h5')`
  margin-bottom: ${space(0.5)};
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
`;

const ShowRelatedExceptionsButton = styled(Button)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
`;
