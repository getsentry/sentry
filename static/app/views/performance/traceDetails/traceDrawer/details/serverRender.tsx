import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {StaticPart} from 'sentry/views/performance/traceDetails/serverRendering/serverRendering';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {ServerRenderNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/serverRenderNode';

import {ServerRenderingSection} from './span/eapSections/serverRendering';
import {TraceDrawerComponents} from './styles';

/** Drawer of the placeholder row. It shows the server rendering section of its pageload. */
export function ServerRenderNodeDetails(
  props: TraceTreeNodeDetailsProps<ServerRenderNode>
) {
  const {node} = props;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {node.description}
            </TraceDrawerComponents.TitleText>
            {/* The placeholder has no ID, so show the ID of the span it belongs to. */}
            <TraceDrawerComponents.SubtitleWithCopyButton
              subTitle={t('Pageload ID: %s', node.pageload.id)}
              clipboardText={node.pageload.id}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={props.organization}
          onTabScrollToNode={props.onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer>
        <Stack gap="lg" padding="lg 0 xl">
          <Text as="p">{getExplanation(node.value.part)}</Text>
          <Text as="p" variant="muted">
            {t(
              'The "%s" row in the waterfall only marks where the reused render fits in this page load. The render happened at some time before this trace.',
              node.description
            )}
          </Text>
        </Stack>
        <PageloadServerRendering {...props} />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

function getExplanation(part: StaticPart): string {
  switch (part) {
    case 'whole_page':
      return t(
        'The server rendered this page earlier, for example at build time, and reused it for this page load. Its server spans are not in this trace. They are in the trace of the earlier render.'
      );
    case 'static_part':
      return t(
        'The server rendered the static part of this page earlier, for example at build time, and reused it for this page load. It rendered only the dynamic parts for this page load. The spans of the static part are in the trace of the earlier render.'
      );
  }
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
    referrer: 'api.trace-view.span-detail',
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
