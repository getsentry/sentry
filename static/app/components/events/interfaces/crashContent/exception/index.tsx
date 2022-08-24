import ErrorBoundary from 'sentry/components/errorBoundary';
import type {ExceptionType, Group, PlatformType, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {STACK_TYPE, STACK_VIEW} from 'sentry/types/stacktrace';

import {Content} from './content';
import RawContent from './rawContent';

type Props = {
  event: Event;
  hasHierarchicalGrouping: boolean;
  newestFirst: boolean;
  platform: PlatformType;
  projectId: Project['id'];
  stackType: STACK_TYPE;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  meta?: Record<any, any>;
  stackView?: STACK_VIEW;
} & Pick<ExceptionType, 'values'>;

function Exception({
  stackView,
  stackType,
  projectId,
  values,
  event,
  newestFirst,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  platform = 'other',
  meta,
}: Props) {
  return (
    <ErrorBoundary mini>
      {stackView === STACK_VIEW.RAW ? (
        <RawContent
          eventId={event.id}
          projectId={projectId}
          type={stackType}
          values={values}
          platform={platform}
        />
      ) : (
        <Content
          type={stackType}
          stackView={stackView}
          values={values}
          platform={platform}
          newestFirst={newestFirst}
          event={event}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
        />
      )}
    </ErrorBoundary>
  );
}

export default Exception;
