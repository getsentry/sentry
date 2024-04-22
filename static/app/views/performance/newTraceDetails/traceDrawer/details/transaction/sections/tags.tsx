import styled from '@emotion/styled';
import type {Location} from 'history';

import NewTagsUI from 'sentry/components/events/eventTagsAndScreenshot/tags';
import {LazyRender} from 'sentry/components/lazyRender';
import type {EventTransaction, Organization} from 'sentry/types';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {Tags} from 'sentry/views/performance/traceDetails/styles';

import {TraceDrawerComponents} from '../../styles';

export function EventTags({
  node,
  organization,
  event,
  location,
}: {
  event: EventTransaction;
  location: Location;
  node: TraceTreeNode<TraceTree.Transaction>;
  organization: Organization;
}) {
  return (
    <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
      {organization.features.includes('event-tags-tree-ui') ? (
        <TagsWrapper>
          <NewTagsUI event={event} projectSlug={node.value.project_slug} />
        </TagsWrapper>
      ) : (
        <TraceDrawerComponents.Table className="table key-value">
          <tbody>
            <Tags
              enableHiding
              location={location}
              organization={organization}
              tags={event.tags}
              event={node.value}
            />
          </tbody>
        </TraceDrawerComponents.Table>
      )}
    </LazyRender>
  );
}

const TagsWrapper = styled('div')`
  h3 {
    color: ${p => p.theme.textColor};
  }
`;
