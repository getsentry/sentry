import type {Location} from 'history';

import {Link} from 'sentry/components/core/link';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {
  getFieldRenderer,
  type RenderFunctionBaggage,
} from 'sentry/utils/discover/fieldRenderers';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import type {Theme} from 'sentry/utils/theme';
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
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

interface TraceSpanLinksProps {
  links: TraceItemResponseLink[];
  location: Location;
  node: TraceTreeNode<TraceTree.EAPSpan>;
  organization: Organization;
  theme: Theme;
}

export function TraceSpanLinks({
  links,
  node,
  organization,
  location,
  theme,
}: TraceSpanLinksProps) {
  const traceDispatch = useTraceStateDispatch();

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
      const traceTarget = generateLinkToEventInTraceView({
        organization,
        location,
        traceSlug: link.traceId,
        timestamp: node.value.start_timestamp,
      });

      const spanTarget = generateLinkToEventInTraceView({
        organization,
        location,
        traceSlug: link.traceId,
        spanId: link.itemId,
        timestamp: node.value.start_timestamp,
      });

      customRenderers[`${prefix}.trace_id`] = () => {
        return (
          <Link to={traceTarget} onClick={closeSpanDetailsDrawer}>
            {traceIdRenderer({trace: link.traceId}, renderBaggage)}
          </Link>
        );
      };

      customRenderers[`${prefix}.span_id`] = () => {
        return (
          <Link to={spanTarget} onClick={closeSpanDetailsDrawer}>
            {spanIdRenderer({span_id: link.itemId}, renderBaggage)}
          </Link>
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
