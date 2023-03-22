import {Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ExceptionType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {Mechanism} from './mechanism';
import {SetupSourceMapsAlert} from './setupSourceMapsAlert';
import {SourceMapDebug} from './sourceMapDebug';
import StackTrace from './stackTrace';
import {debugFramesEnabled, getUniqueFilesFromException} from './useSourceMapDebug';

type StackTraceProps = React.ComponentProps<typeof StackTrace>;

type Props = {
  event: Event;
  platform: StackTraceProps['platform'];
  projectSlug: Project['slug'];
  type: STACK_TYPE;
  meta?: Record<any, any>;
  newestFirst?: boolean;
  stackView?: StackTraceProps['stackView'];
} & Pick<ExceptionType, 'values'> &
  Pick<
    React.ComponentProps<typeof StackTrace>,
    'groupingCurrentLevel' | 'hasHierarchicalGrouping'
  >;

export function Content({
  newestFirst,
  event,
  stackView,
  groupingCurrentLevel,
  hasHierarchicalGrouping,
  platform,
  projectSlug,
  values,
  type,
  meta,
}: Props) {
  // Organization context may be unavailable for the shared event view, so we
  // avoid using the `useOrganization` hook here and directly useContext
  // instead.
  const organization = useContext(OrganizationContext);
  if (!values) {
    return null;
  }

  const shouldDebugFrames = debugFramesEnabled({
    sdkName: event.sdk?.name,
    organization,
    eventId: event.id,
    projectSlug,
  });
  const debugFrames = shouldDebugFrames
    ? getUniqueFilesFromException(values, {
        eventId: event.id,
        projectSlug: projectSlug!,
        orgSlug: organization!.slug,
      })
    : [];

  const children = values.map((exc, excIdx) => {
    const hasSourcemapDebug = debugFrames.some(
      ({query}) => query.exceptionIdx === excIdx
    );
    return (
      <div key={excIdx} className="exception">
        {defined(exc?.module) ? (
          <Tooltip title={tct('from [exceptionModule]', {exceptionModule: exc?.module})}>
            <Title>{exc.type}</Title>
          </Tooltip>
        ) : (
          <Title>{exc.type}</Title>
        )}
        <StyledPre className="exc-message">
          {meta?.[excIdx]?.value?.[''] && !exc.value ? (
            <AnnotatedText value={exc.value} meta={meta?.[excIdx]?.value?.['']} />
          ) : (
            exc.value
          )}
        </StyledPre>
        {exc.mechanism && (
          <Mechanism data={exc.mechanism} meta={meta?.[excIdx]?.mechanism} />
        )}
        <ErrorBoundary mini>
          <Fragment>
            {!shouldDebugFrames && excIdx === 0 && <SetupSourceMapsAlert event={event} />}
            {hasSourcemapDebug && (
              <SourceMapDebug debugFrames={debugFrames} event={event} />
            )}
          </Fragment>
        </ErrorBoundary>
        <StackTrace
          data={
            type === STACK_TYPE.ORIGINAL
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
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta?.[excIdx]?.stacktrace}
          debugFrames={hasSourcemapDebug ? debugFrames : undefined}
        />
      </div>
    );
  });

  if (newestFirst) {
    children.reverse();
  }

  return <div>{children}</div>;
}

const StyledPre = styled('pre')`
  margin-bottom: ${space(1)};
  margin-top: 0;
`;

const Title = styled('h5')`
  margin-bottom: ${space(0.5)};
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
`;
