import ErrorBoundary from 'sentry/components/errorBoundary';
import {ExceptionType, Group, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StackType, StackView} from 'sentry/types/stacktrace';

import {Content} from './content';
import RawContent from './rawContent';

type Props = {
  event: Event;
  hasHierarchicalGrouping: boolean;
  newestFirst: boolean;
  projectSlug: Project['slug'];
  stackType: StackType;
  groupingCurrentLevel?: Group['metadata']['current_level'];
  meta?: Record<any, any>;
  stackView?: StackView;
  threadId?: number;
} & Pick<ExceptionType, 'values'>;

export function ExceptionContent({
  stackView,
  stackType,
  projectSlug,
  values,
  event,
  newestFirst,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  meta,
  threadId,
}: Props) {
  return (
    <ErrorBoundary mini>
      {stackView === StackView.RAW ? (
        <RawContent
          eventId={event.id}
          projectSlug={projectSlug}
          type={stackType}
          values={values}
          platform={event.platform}
        />
      ) : (
        <Content
          type={stackType}
          stackView={stackView}
          values={values}
          projectSlug={projectSlug}
          newestFirst={newestFirst}
          event={event}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          threadId={threadId}
        />
      )}
    </ErrorBoundary>
  );
}
