import type {Location} from 'history';

import {Link} from 'sentry/components/core/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Theme} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AttributesTree,
  type AttributesFieldRendererProps,
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
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

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
  const currentLocation = useLocation();
  const currentOrganization = useOrganization();
  const traceDispatch = useTraceStateDispatch();

  // Close span details drawer when navigating
  function closeSpanDetailsDrawer() {
    traceDispatch({
      type: 'minimize drawer',
      payload: true,
    });
  }

  // Create custom renderers for trace_id and span_id attributes
  const customRenderers: Record<
    string,
    (
      props: AttributesFieldRendererProps<{
        location: Location;
        organization: Organization;
        theme: Theme;
      }>
    ) => React.ReactNode
  > = {};

  const linksAsAttributes: TraceItemResponseAttribute[] = links.flatMap(
    (link, linkIndex) => {
      const prefix = `span_link_${linkIndex + 1}`;
      const dateSelection = normalizeDateTimeParams(currentLocation.query);

      // Create custom renderer for trace_id using TraceLinkNavigationButton pattern
      customRenderers[`${prefix}.trace_id`] = props => {
        const traceTarget = getTraceDetailsUrl({
          traceSlug: link.traceId,
          dateSelection,
          timestamp: node.value.start_timestamp,
          location: currentLocation,
          organization: currentOrganization,
        });

        return (
          <Link
            to={traceTarget}
            onClick={closeSpanDetailsDrawer}
            style={{
              fontWeight: 'normal',
              color: 'inherit',
            }}
          >
            {props.basicRendered}
          </Link>
        );
      };

      // Create custom renderer for span_id using TraceLinkNavigationButton pattern
      customRenderers[`${prefix}.span_id`] = props => {
        const spanTarget = getTraceDetailsUrl({
          traceSlug: link.traceId,
          spanId: link.itemId,
          dateSelection,
          timestamp: node.value.start_timestamp,
          location: currentLocation,
          organization: currentOrganization,
        });

        return (
          <Link
            to={spanTarget}
            onClick={closeSpanDetailsDrawer}
            style={{
              fontWeight: 'normal',
              color: 'inherit',
            }}
          >
            {props.basicRendered}
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
