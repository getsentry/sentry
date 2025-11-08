import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {
  getFieldRenderer,
  type RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import type {Theme} from 'sentry/utils/theme';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  AttributesTree,
  type AttributesFieldRender,
} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  type TraceItemResponseAttribute,
  type TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

interface TraceSpanLinksProps {
  links: TraceItemResponseLink[];
  location: Location;
  node: EapSpanNode;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  theme: Theme;
  traceId: string;
  tree?: TraceTree;
}

export function TraceSpanLinks({
  tree,
  links,
  node,
  organization,
  location,
  theme,
  traceId,
  onTabScrollToNode,
}: TraceSpanLinksProps) {
  const traceDispatch = useTraceStateDispatch();
  const navigate = useNavigate();

  function closeSpanDetailsDrawer() {
    traceDispatch({
      type: 'minimize drawer',
      payload: true,
    });
  }

  // Render the span links an a single attribute tree. For each link, give it a
  // serial integer prefix. For each of those prefixes, create a custom renderer
  // for that unique trace ID and span ID field. e.g., for the first link the
  // prefix is `"span_link_1"`. Create a renderer for the field
  // `"span_link_1.trace_id"` and `span_link_1.span_id"`. This is somewhat of a
  // hack, and a cleaner approach would be to render a separate little section
  // and separate attribute tree for each link, rather than giving them this
  // awkward prefix just to render them all in a single tree.
  const customRenderers: AttributesFieldRender<RenderFunctionBaggage>['renderers'] = {};

  const traceIdRenderer = getFieldRenderer('trace', {});
  const spanIdRenderer = getFieldRenderer('span_id', {});

  const renderBaggage = {
    organization,
    location,
    theme,
  };

  const linksAsAttributes: TraceItemResponseAttribute[] = links.flatMap(
    (link, linkIndex) => {
      const prefix = `span_link_${linkIndex + 1}`;

      customRenderers[`${prefix}.trace_id`] = () => {
        const traceTarget = generateLinkToEventInTraceView({
          organization,
          location,
          traceSlug: link.traceId,
          timestamp: node.value.start_timestamp,
          tab: TraceLayoutTabKeys.WATERFALL,
        });

        return (
          <a
            onClick={() => {
              // If we are outside the traceview, or the link is to a different trace, we navigate to the trace
              // otherwise we do nothing
              if (!tree || link.traceId !== traceId) {
                closeSpanDetailsDrawer();
                navigate(traceTarget);
              }
            }}
          >
            {traceIdRenderer({trace: link.traceId}, renderBaggage)}
          </a>
        );
      };

      customRenderers[`${prefix}.span_id`] = () => {
        const spanTarget = generateLinkToEventInTraceView({
          organization,
          location,
          traceSlug: link.traceId,
          spanId: link.itemId,
          timestamp: node.value.start_timestamp,
          tab: TraceLayoutTabKeys.WATERFALL,
        });

        return (
          <a
            onClick={() => {
              // If we are outside the trace waterfall, or the link is to a span in a different trace, we navigate
              if (!tree || link.traceId !== traceId) {
                closeSpanDetailsDrawer();
                navigate(spanTarget);
                return;
              }

              // If the link is to the same trace, we look for and navigate to the span in the same trace waterfall
              const spanNode = tree.root.findChild(c => c.matchById(link.itemId));
              if (spanNode) {
                onTabScrollToNode(spanNode);
              }
            }}
          >
            {spanIdRenderer({span_id: link.itemId}, renderBaggage)}
          </a>
        );
      };

      return [
        {
          name: `${prefix}.trace_id`,
          type: 'str',
          value: link.traceId,
        },
        {
          name: `${prefix}.span_id`,
          type: 'str',
          value: link.itemId,
        },
        ...(link.attributes || []).map(attribute => ({
          ...attribute,
          name: `${prefix}.attributes.${attribute.name}`,
        })),
      ];
    }
  );

  return (
    <FoldSection
      sectionKey={SectionKey.SPAN_LINKS}
      initialCollapse
      title={
        <TraceDrawerComponents.SectionTitleWithQuestionTooltip
          title={t('Links')}
          tooltipText={t(
            'Span links are used to describe relationships between spans beyond parent-child relationships.'
          )}
        />
      }
    >
      <AttributesTree
        attributes={linksAsAttributes}
        columnCount={1}
        config={{
          disableActions: true,
        }}
        rendererExtra={{
          theme,
          location,
          organization,
        }}
        renderers={customRenderers}
      />
    </FoldSection>
  );
}
