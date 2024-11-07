import {lazy} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceDataSection} from 'sentry/views/issueDetails/traceDataSection';

const LazyEventTraceWaterfall = lazy(
  () => import('sentry/components/events/interfaces/performance/eventTraceWaterfall')
);

interface EventTraceViewProps {
  event: Event;
  group: Group;
  organization: Organization;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  // Check trace id exists
  if (!event || !event.contexts.trace?.trace_id) {
    return null;
  }

  const hasProfilingFeature = organization.features.includes('profiling');
  const hasIssueDetailsTrace = organization.features.includes(
    'issue-details-always-show-trace'
  );
  const hasTracePreviewFeature = hasProfilingFeature && hasIssueDetailsTrace;

  // Only display this for error or default events since performance events are handled elsewhere
  if (group.issueCategory === IssueCategory.PERFORMANCE) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <InterimSection type={SectionKey.TRACE} title={t('Trace')}>
        <TraceContentWrapper>
          <div>
            <TraceDataSection event={event} />
          </div>
          {hasTracePreviewFeature && (
            <LazyLoad
              LazyComponent={LazyEventTraceWaterfall}
              event={event}
              organization={organization}
            />
          )}
        </TraceContentWrapper>
      </InterimSection>
    </ErrorBoundary>
  );
}

const TraceContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;
