import ErrorBoundary from 'app/components/errorBoundary';
import ExceptionContent from 'app/components/events/interfaces/exceptionContent';
import RawExceptionContent from 'app/components/events/interfaces/rawExceptionContent';
import {ExceptionType, Group, PlatformType, Project} from 'app/types';
import {Event} from 'app/types/event';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';

type Props = {
  stackType: STACK_TYPE;
  projectId: Project['id'];
  event: Event;
  newestFirst: boolean;
  platform: PlatformType;
  hasHierarchicalGrouping: boolean;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  stackView?: STACK_VIEW;
} & Pick<ExceptionType, 'values'>;

const Exception = ({
  stackView,
  stackType,
  projectId,
  values,
  event,
  newestFirst,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  platform = 'other',
}: Props) => (
  <ErrorBoundary mini>
    {stackView === STACK_VIEW.RAW ? (
      <RawExceptionContent
        eventId={event.id}
        projectId={projectId}
        type={stackType}
        values={values}
        platform={platform}
      />
    ) : (
      <ExceptionContent
        type={stackType}
        stackView={stackView}
        values={values}
        platform={platform}
        newestFirst={newestFirst}
        event={event}
        hasHierarchicalGrouping={hasHierarchicalGrouping}
        groupingCurrentLevel={groupingCurrentLevel}
      />
    )}
  </ErrorBoundary>
);

export default Exception;
