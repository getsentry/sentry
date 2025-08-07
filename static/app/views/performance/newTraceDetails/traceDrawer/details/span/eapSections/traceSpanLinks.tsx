import type {Location} from 'history';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Theme} from 'sentry/utils/theme';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  type TraceItemResponseAttribute,
  type TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

interface TraceSpanLinksProps {
  links: TraceItemResponseLink[];
  location: Location;
  node: TraceTreeNode<TraceTree.EAPSpan>;
  organization: Organization;
  theme: Theme;
}

export function TraceSpanLinks({
  links,
  organization,
  location,
  theme,
}: TraceSpanLinksProps) {
  // Render the links as a tree of attributes. This visual treatment requires
  // that we format the trace ID and span ID as attributes, even though they are
  // top level fields. I think we should convince Design to reconsider this
  // treatment, but for now we'll need to create synthetic attributes for the
  // span ID and trace ID, and prefix the actual attributes with a special key.
  const linksAsAttributes: TraceItemResponseAttribute[] = links.flatMap(
    (link, linkIndex) => {
      const prefix = `span_link_${linkIndex + 1}`;

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
          disableRichValue: true,
        }}
        rendererExtra={{
          theme,
          location,
          organization,
        }}
      />
    </FoldSection>
  );
}
