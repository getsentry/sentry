import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {ServerRenderNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/serverRenderNode';

import {ServerRenderingSection} from './span/eapSections/serverRendering';
import {TraceDrawerComponents} from './styles';

/** Drawer of the placeholder row. It shows the server rendering section of its pageload. */
export function ServerRenderNodeDetails(
  props: TraceTreeNodeDetailsProps<ServerRenderNode>
) {
  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {props.node.description}
            </TraceDrawerComponents.TitleText>
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer>
        <PageloadServerRendering {...props} />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

/** The tree has no span links, so load them with the pageload's details. */
function PageloadServerRendering(props: TraceTreeNodeDetailsProps<ServerRenderNode>) {
  const {pageload} = props.node;
  const location = useLocation();
  // Same request as the pageload's span details, so both share one cache entry.
  const {data, isPending, isError} = useTraceItemDetails({
    traceItemId: pageload.value.event_id,
    projectId: pageload.value.project_id.toString(),
    traceId: pageload.extra?.replayTraceSlug ?? props.traceId,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details', // TODO: change to span details
    timestamp: pageload.value.start_timestamp,
    enabled: true,
  });

  if (isPending) {
    return <Placeholder height="120px" />;
  }
  if (isError) {
    return <Text variant="muted">{t('Failed to load server rendering details')}</Text>;
  }

  return (
    <ServerRenderingSection
      node={pageload}
      attributes={data.attributes}
      links={data.links}
      location={location}
      organization={props.organization}
      tree={props.tree}
      onTabScrollToNode={props.onTabScrollToNode}
    />
  );
}
