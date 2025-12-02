import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Container} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {StacktraceBanners} from 'sentry/components/events/interfaces/crashContent/exception/banners/stacktraceBanners';
import {useLineCoverageContext} from 'sentry/components/events/interfaces/crashContent/exception/lineCoverageContext';
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
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useProjects from 'sentry/utils/useProjects';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {
  FoldSection,
  SectionDivider,
} from 'sentry/views/issueDetails/streamline/foldSection';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';

import {LineCoverageLegend} from './lineCoverageLegend';
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

/**
 * We want to hide all children of an exception group is the exception group
 * itself is not the root level exception.
 */
const useHiddenExceptions = (values?: ExceptionValue[]) => {
  // map of exception group ids and whether their children are hidden
  const [hiddenExceptions, setHiddenExceptions] = useState<ExceptionRenderStateMap>(
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
      if (!defined(exceptionGroupId) || !defined(old[exceptionGroupId])) {
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

  if (!defined(exceptionId) || !defined(hiddenExceptions[exceptionId])) {
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
        ? tn('Show %s related exception', 'Show %s related exceptions', numChildren)
        : tn('Hide %s related exception', 'Hide %s related exceptions', numChildren)}
    </ShowRelatedExceptionsButton>
  );
}

function InnerContent({
  exception,
  exceptionIdx,
  project,
  event,
  meta,
  newestFirst,
  values,
  threadId,
  type,
  hasChainedExceptions,
  sourceMapDebuggerData,
  isSampleError,
  stackView,
  groupingCurrentLevel,
  hiddenExceptions,
  toggleRelatedExceptions,
  expandException,
}: {
  exception: ExceptionValue;
  exceptionIdx: number;
  expandException: (exceptionId: number) => void;
  hasChainedExceptions: boolean;
  hiddenExceptions: ExceptionRenderStateMap;
  isSampleError: boolean;
  sourceMapDebuggerData: ReturnType<typeof useSourceMapDebuggerData>;
  toggleRelatedExceptions: (exceptionId: number) => void;
  values: ExceptionValue[];
  project?: Project;
} & Omit<Props, 'projectSlug'>) {
  const frameSourceMapDebuggerData = sourceMapDebuggerData?.exceptions[
    exceptionIdx
  ]!.frames.map(debuggerFrame =>
    prepareSourceMapDebuggerFrameInformation(
      sourceMapDebuggerData,
      debuggerFrame,
      event,
      project?.platform
    )
  );
  const exceptionValue =
    type === StackType.ORIGINAL ? exception.value : exception.rawValue || exception.value;

  const renderedExceptionValue = exceptionValue
    ? renderLinksInText({exceptionText: exceptionValue})
    : null;
  const platform = getStacktracePlatform(event, exception.stacktrace);

  // The banners should appear on the top exception only
  const isTopException = newestFirst
    ? exceptionIdx === values.length - 1
    : exceptionIdx === 0;

  const {hasCoverageData} = useLineCoverageContext();
  return (
    <Fragment>
      <StyledPre>
        {meta?.[exceptionIdx]?.value?.[''] && !exceptionValue ? (
          <AnnotatedText
            value={exceptionValue}
            meta={meta?.[exceptionIdx]?.value?.['']}
          />
        ) : (
          renderedExceptionValue
        )}
      </StyledPre>
      <ToggleExceptionButton
        {...{hiddenExceptions, toggleRelatedExceptions, values, exception}}
      />
      {exception.mechanism ? (
        <Container paddingTop="xl">
          <Mechanism data={exception.mechanism} meta={meta?.[exceptionIdx]?.mechanism} />
        </Container>
      ) : null}
      {hasCoverageData ? (
        <Container paddingTop="md">
          <LineCoverageLegend />
        </Container>
      ) : null}
      <RelatedExceptions
        mechanism={exception.mechanism}
        allExceptions={values}
        newestFirst={newestFirst}
        onExceptionClick={expandException}
      />
      {exception.stacktrace && isTopException && !isSampleError && (
        <ErrorBoundary customComponent={null}>
          <StacktraceBanners event={event} stacktrace={exception.stacktrace} />
        </ErrorBoundary>
      )}
      <StackTrace
        data={
          type === StackType.ORIGINAL
            ? exception.stacktrace
            : exception.rawStacktrace || exception.stacktrace
        }
        stackView={stackView}
        stacktrace={exception.stacktrace}
        expandFirstFrame={exceptionIdx === values.length - 1}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
        chainedException={hasChainedExceptions}
        groupingCurrentLevel={groupingCurrentLevel}
        meta={meta?.[exceptionIdx]?.stacktrace}
        threadId={threadId}
        frameSourceMapDebuggerData={frameSourceMapDebuggerData}
        stackType={type}
      />
    </Fragment>
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

  const sourceMapDebuggerData = useSourceMapDebuggerData(event, projectSlug);
  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);

  const isSampleError = useIsSampleEvent();

  useRouteAnalyticsParams({
    num_exceptions: values?.length ?? 0,
  });

  // Organization context may be unavailable for the shared event view, so we need
  // to account for this possibility if we rely on the `useOrganization` hook.
  if (!values) {
    return null;
  }

  const project = projects.find(({slug}) => slug === projectSlug);
  const hasChainedExceptions = values.length > 1;

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

    const innerContent = (
      <InnerContent
        exception={exc}
        exceptionIdx={excIdx}
        hasChainedExceptions={hasChainedExceptions}
        isSampleError={isSampleError}
        project={project}
        sourceMapDebuggerData={sourceMapDebuggerData}
        values={values}
        newestFirst={newestFirst}
        event={event}
        type={type}
        meta={meta}
        threadId={threadId}
        stackView={stackView}
        groupingCurrentLevel={groupingCurrentLevel}
        hiddenExceptions={hiddenExceptions}
        toggleRelatedExceptions={toggleRelatedExceptions}
        expandException={expandException}
      />
    );

    const exceptionType =
      type === StackType.ORIGINAL ? exc.type : exc.rawType || exc.type;
    const exceptionModule =
      type === StackType.ORIGINAL ? exc.module : exc.rawModule || exc.module;
    if (hasChainedExceptions) {
      return (
        <StyledFoldSection
          key={excIdx}
          className="exception"
          dataTestId="exception-value"
          sectionKey={SectionKey.CHAINED_EXCEPTION}
          title={
            defined(exceptionModule) ? (
              <Tooltip title={tct('from [exceptionModule]', {exceptionModule})}>
                <Title id={id}>{exceptionType}</Title>
              </Tooltip>
            ) : (
              <Title id={id}>{exceptionType}</Title>
            )
          }
          disableCollapsePersistence
          initialCollapse={excIdx < values.length - 3}
          additionalIdentifier={
            exc.mechanism?.exception_id?.toString() ?? excIdx.toString()
          }
        >
          {innerContent}
        </StyledFoldSection>
      );
    }

    return (
      <div key={excIdx} className="exception" data-test-id="exception-value">
        {defined(exceptionModule) ? (
          <Tooltip title={tct('from [exceptionModule]', {exceptionModule})}>
            <Title id={id}>{exceptionType}</Title>
          </Tooltip>
        ) : (
          <Title id={id}>{exceptionType}</Title>
        )}
        {innerContent}
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
          <SectionDivider orientation="horizontal" />
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
  margin-left: -${p => p.theme.space.sm};

  & ~ hr {
    margin-left: ${p => p.theme.space.xl};
    margin-right: ${p => p.theme.space.xl};
  }
`;
