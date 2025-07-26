import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {
  prepareSourceMapDebuggerFrameInformation,
  useSourceMapDebuggerData,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {renderLinksInText} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import {getStacktracePlatform} from 'sentry/components/events/interfaces/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {tct, tn} from 'sentry/locale';
import type {Event, ExceptionType, ExceptionValue} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {StackType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import useProjects from 'sentry/utils/useProjects';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {
  FoldSection,
  SectionDivider,
} from 'sentry/views/issueDetails/streamline/foldSection';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';

import {Mechanism} from './mechanism';
import {RelatedExceptions} from './relatedExceptions';
import StackTrace from './stackTrace';

type StackTraceProps = React.ComponentProps<typeof StackTrace>;

type Props = {
  event: Event;
  newestFirst: boolean;
  projectSlug: Project['slug'];
  type: StackType;
  values: ExceptionType['values'];
  meta?: Record<any, any>;
  stackView?: StackTraceProps['stackView'];
  threadId?: number;
} & Pick<React.ComponentProps<typeof StackTrace>, 'groupingCurrentLevel'>;

type ExceptionRenderStateMap = Record<number, boolean>;

const useHiddenExceptions = (values?: ExceptionValue[]) => {
  // map of parent exceptions and whether their children are hidden
  const [hiddenExceptions, setHiddenExceptions] = useState<ExceptionRenderStateMap>(
    () => {
      if (!values) {
        return {};
      }

      return values
        .filter(({mechanism}) => mechanism?.is_exception_group)
        .reduce(
          (acc, next) => ({...acc, [next.mechanism?.exception_id ?? -1]: true}),
          {}
        );
    }
  );

  const toggleRelatedExceptions = (exceptionId: number) => {
    setHiddenExceptions(old => {
      if (!defined(old[exceptionId])) {
        return old;
      }

      return {...old, [exceptionId]: !old[exceptionId]};
    });
  };

  const expandException = (exceptionId: number) => {
    setHiddenExceptions(old => {
      const exceptionValue = values?.find(
        value => value.mechanism?.exception_id === exceptionId
      );
      const exceptionGroupId = exceptionValue?.mechanism?.parent_id;
      if (exceptionGroupId === undefined || !defined(old[exceptionGroupId])) {
        return old;
      }

      return {...old, [exceptionGroupId]: false};
    });
  };

  return {
    toggleRelatedExceptions,
    hiddenExceptions,
    expandException,
  };
};

function ToggleExceptionButton({
  values,
  exception,
  toggleRelatedExceptions,
  hiddenExceptions,
}: {
  exception: ExceptionValue;
  hiddenExceptions: ExceptionRenderStateMap;
  toggleRelatedExceptions: (exceptionId: number) => void;
  values: ExceptionValue[];
}) {
  const exceptionId = exception.mechanism?.exception_id;

  if (exceptionId === undefined || !defined(hiddenExceptions[exceptionId])) {
    return null;
  }

  const collapsed = hiddenExceptions[exceptionId];
  const numChildren = values.filter(
    ({mechanism}) => mechanism?.parent_id === exceptionId
  ).length;

  return (
    <ShowRelatedExceptionsButton
      priority="link"
      onClick={() => {
        toggleRelatedExceptions(exceptionId);
      }}
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
  const {projects} = useProjects({slugs: [projectSlug]});

  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);

  const sourceMapDebuggerData = useSourceMapDebuggerData(event, projectSlug);

  const isSampleError = useIsSampleEvent();

  // Organization context may be unavailable for the shared event view, so we
  // avoid using the `useOrganization` hook here and directly useContext
  // instead.
  if (!values) {
    return null;
  }

  const project = projects.find(({slug}) => slug === projectSlug);
  const hasChainedExceptions = values.length > 1;

  const getInnerContent = ({excIdx, exc}: {exc: ExceptionValue; excIdx: number}) => {
    const frameSourceMapDebuggerData = sourceMapDebuggerData?.exceptions[
      excIdx
    ]!.frames.map(debuggerFrame =>
      prepareSourceMapDebuggerFrameInformation(
        sourceMapDebuggerData,
        debuggerFrame,
        event,
        project?.platform
      )
    );
    const exceptionValue = exc.value
      ? renderLinksInText({exceptionText: exc.value})
      : null;

    const platform = getStacktracePlatform(event, exc.stacktrace);

    // The banners should appear on the top exception only
    const isTopException = newestFirst ? excIdx === values.length - 1 : excIdx === 0;

    return (
      <Fragment>
        {' '}
        <StyledPre>
          {meta?.[excIdx]?.value?.[''] && !exc.value ? (
            <AnnotatedText value={exc.value} meta={meta?.[excIdx]?.value?.['']} />
          ) : (
            exceptionValue
          )}
        </StyledPre>
        <ToggleExceptionButton
          {...{hiddenExceptions, toggleRelatedExceptions, values, exception: exc}}
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
          chainedException={hasChainedExceptions}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta?.[excIdx]?.stacktrace}
          threadId={threadId}
          frameSourceMapDebuggerData={frameSourceMapDebuggerData}
          stackType={type}
        />
      </Fragment>
    );
  };

  const children = values.map((exc, excIdx) => {
    const id = defined(exc.mechanism?.exception_id)
      ? `exception-${exc.mechanism?.exception_id}`
      : undefined;

    if (
      exc.mechanism?.parent_id !== undefined &&
      hiddenExceptions[exc.mechanism.parent_id]
    ) {
      // hide all child exceptions when the parent
      // does not have related exceptions toggled to show
      return null;
    }

    if (hasChainedExceptions) {
      return (
        <StyledFoldSection
          key={excIdx}
          className="exception"
          dataTestId="exception-value"
          sectionKey={SectionKey.CHAINED_EXCEPTION}
          title={
            defined(exc?.module) ? (
              <Tooltip
                title={tct('from [exceptionModule]', {exceptionModule: exc?.module})}
              >
                <Title id={id}>{exc.type}</Title>
              </Tooltip>
            ) : (
              <Title id={id}>{exc.type}</Title>
            )
          }
          disableCollapsePersistence
          initialCollapse={excIdx !== values.length - 1}
          additionalIdentifier={exc.mechanism?.exception_id?.toString() ?? ''}
        >
          {getInnerContent({excIdx, exc})}
        </StyledFoldSection>
      );
    }

    return (
      <div key={excIdx} className="exception" data-test-id="exception-value">
        {defined(exc?.module) ? (
          <Tooltip title={tct('from [exceptionModule]', {exceptionModule: exc?.module})}>
            <Title id={id}>{exc.type}</Title>
          </Tooltip>
        ) : (
          <Title id={id}>{exc.type}</Title>
        )}
        {getInnerContent({excIdx, exc})}
      </div>
    );
  });

  if (newestFirst) {
    children.reverse();
  }

  return (
    <div>
      {hasChainedExceptions && (
        <Fragment>
          <p>
            {tct('There are [numExceptions] chained exceptions in this event.', {
              numExceptions: values.length,
            })}
          </p>
          <SectionDivider />
        </Fragment>
      )}
      {children}
    </div>
  );
}

const StyledPre = styled('pre')`
  padding: 0;
  margin: 0;
  word-wrap: break-word;
  white-space: pre-wrap;
  background-color: inherit;
`;

const Title = styled('h5')`
  margin-bottom: 0;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
`;

const ShowRelatedExceptionsButton = styled(Button)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
`;

const StyledFoldSection = styled(FoldSection)`
  margin-bottom: 0;

  & ~ hr {
    margin-left: ${p => p.theme.space.xl};
    margin-right: ${p => p.theme.space.xl};
  }
`;
