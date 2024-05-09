import styled from '@emotion/styled';
import type {Location} from 'history';

import NewTagsUI from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {LazyRender} from 'sentry/components/lazyRender';
import type {EventTransaction, Organization, Project} from 'sentry/types';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {TraceDrawerComponents} from '../../styles';

export function EventTags({
  event,
  project,
}: {
  event: EventTransaction;
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
  project: Project;
}) {
  return (
    <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
      <TagsWrapper>
        <NewTagsUI event={event} project={project} />
      </TagsWrapper>
    </LazyRender>
  );
}

const TagsWrapper = styled('div')`
  h3 {
    color: ${p => p.theme.textColor};
  }
`;
