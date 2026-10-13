import {SEARCH_SENTRY__LINK__TYPE} from '@sentry/conventions/attributes/search';
import type {Location} from 'history';
import countBy from 'lodash/countBy';

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
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {getSpanLinkType} from 'sentry/views/performance/traceDetails/getSpanLinkType';
import {TraceDrawerComponents} from 'sentry/views/performance/traceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import type {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {useTraceStateDispatch} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';
import {TraceLayoutTabKeys} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

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

const UNTYPED_LINK_NAME = 'link';

/**
 * Names each link's tree group after its link type, or `link` without a type.
 * The tree merges groups with the same name, so repeats get a counter: `cache_origin (2)`.
 */
function getNamedLinks(
  links: TraceItemResponseLink[]
): Array<{groupName: string; link: TraceItemResponseLink}> {
  const getName = (link: TraceItemResponseLink) =>
    getSpanLinkType(link) ?? UNTYPED_LINK_NAME;
  const totals = countBy(links, getName);
  const seen: Record<string, number> = {};

  return links.map(link => {
    const name = getName(link);
    if (totals[name] === 1) {
      return {link, groupName: name};
    }
    seen[name] = (seen[name] ?? 0) + 1;
    return {link, groupName: `${name} (${seen[name]})`};
  });
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

  // All links share one attribute tree, so each link's fields get its group name as
  // prefix, with custom renderers per prefix (e.g. `previous_trace.trace_id`).
  // A separate tree per link would be cleaner.
  const customRenderers: AttributesFieldRender<RenderFunctionBaggage>['renderers'] = {};

  const traceIdRenderer = getFieldRenderer('trace', {});
  const spanIdRenderer = getFieldRenderer('span_id', {});

  const renderBaggage = {
    organization,
    location,
    navigate,
    theme,
  };

  const linksAsAttributes: TraceItemResponseAttribute[] = getNamedLinks(links).flatMap(
    ({link, groupName: prefix}) => {
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
        ...(link.sampled === undefined
          ? []
          : [{name: `${prefix}.sampled`, type: 'bool' as const, value: link.sampled}]),
        // The link type is the group name already.
        ...(link.attributes || [])
          .filter(attribute => attribute.name !== SEARCH_SENTRY__LINK__TYPE)
          .map(attribute => ({
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
          navigate,
          organization,
        }}
        renderers={customRenderers}
      />
    </FoldSection>
  );
}
