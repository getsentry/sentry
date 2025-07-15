import {useMemo, useState} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location, LocationDescriptorObject} from 'history';

import {Link} from 'sentry/components/core/link';
import BaseSearchBar from 'sentry/components/searchBar';
import {StructuredData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {FieldKey} from 'sentry/utils/fields';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {looksLikeAJSONArray} from 'sentry/utils/string/looksLikeAJSONArray';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import type {AttributesFieldRendererProps} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {extendWithLegacyAttributeKeys} from 'sentry/views/insights/agentMonitoring/utils/query';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  findSpanAttributeValue,
  getTraceAttributesTreeActions,
  sortAttributes,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {useTraceState} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {useOTelFriendlyUI} from 'sentry/views/performance/otlp/useOTelFriendlyUI';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

type CustomRenderersProps = AttributesFieldRendererProps<RenderFunctionBaggage>;

const HIDDEN_ATTRIBUTES = ['is_segment', 'project_id', 'received'];
const JSON_ATTRIBUTES = extendWithLegacyAttributeKeys([
  'gen_ai.request.messages',
  'gen_ai.response.messages',
  'gen_ai.response.tool_calls',
  'gen_ai.response.object',
  'gen_ai.prompt',
  'gen_ai.request.available_tools',
  'ai.prompt',
]);
const TRUNCATED_TEXT_ATTRIBUTES = ['gen_ai.response.text'];

function tryParseJson(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    const parsedValue = JSON.parse(value);
    // Some arrays are double stringified, so we need to unwrap them
    // This needs to be fixed on the SDK side
    // TODO: Remove this once the SDK is fixed
    if (!Array.isArray(parsedValue)) {
      return parsedValue;
    }
    return parsedValue.map((item: any): any => tryParseJson(item));
  } catch (error) {
    return value;
  }
}

const jsonRenderer = (props: CustomRenderersProps) => {
  const value = tryParseJson(props.item.value);
  return <StructuredData value={value} withAnnotatedText maxDefaultDepth={0} />;
};

const truncatedTextRenderer = (props: CustomRenderersProps) => {
  if (typeof props.item.value !== 'string') {
    return props.item.value;
  }
  return ellipsize(props.item.value, 100);
};

export function Attributes({
  node,
  attributes,
  theme,
  location,
  organization,
  project,
}: {
  attributes: TraceItemResponseAttribute[];
  location: Location;
  node: TraceTreeNode<TraceTree.EAPSpan>;
  organization: Organization;
  project: Project | undefined;
  theme: Theme;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const traceState = useTraceState();
  const isSentryEmployee = useIsSentryEmployee();
  const shouldUseOTelFriendlyUI = useOTelFriendlyUI();
  const columnCount =
    traceState.preferences.layout === 'drawer left' ||
    traceState.preferences.layout === 'drawer right'
      ? 1
      : undefined;

  const sortedAndFilteredAttributes = useMemo(() => {
    const sortedAttributes = sortAttributes(attributes);

    const onlyVisibleAttributes = sortedAttributes.filter(
      attribute => !HIDDEN_ATTRIBUTES.includes(attribute.name)
    );

    // `__sentry_internal` attributes are used to track internal system behavior (e.g., the span buffer outcomes). Only show these to Sentry staff.
    const onlyAllowedAttributes = onlyVisibleAttributes.filter(attribute => {
      if (attribute.name.startsWith('__sentry_internal') && !isSentryEmployee) {
        return false;
      }

      return true;
    });

    const filteredByOTelMode = onlyAllowedAttributes.filter(attribute => {
      if (shouldUseOTelFriendlyUI) {
        return !['span.description', 'span.op'].includes(attribute.name);
      }

      return attribute.name !== 'span.name';
    });

    if (!searchQuery.trim()) {
      return filteredByOTelMode;
    }

    const normalizedSearchQuery = searchQuery.toLowerCase().trim();

    const onlyMatchingAttributes = filteredByOTelMode.filter(attribute => {
      return attribute.name.toLowerCase().trim().includes(normalizedSearchQuery);
    });

    return onlyMatchingAttributes;
  }, [attributes, searchQuery, isSentryEmployee, shouldUseOTelFriendlyUI]);

  const customRenderers: Record<
    string,
    (props: CustomRenderersProps) => React.ReactNode
  > = {
    [FieldKey.PROFILE_ID]: (props: CustomRenderersProps) => {
      const target = generateProfileFlamechartRoute({
        organization,
        projectSlug: project?.slug ?? '',
        profileId: String(props.item.value),
      });

      return (
        <StyledLink
          data-test-id="view-profile"
          to={{
            pathname: target,
            query: {
              spanId: node.value.event_id,
            },
          }}
          onClick={() =>
            trackAnalytics('profiling_views.go_to_flamegraph', {
              organization,
              source: 'performance.trace_view.details',
            })
          }
        >
          {props.item.value}
        </StyledLink>
      );
    },
    [FieldKey.REPLAY_ID]: (props: CustomRenderersProps) => {
      const target: LocationDescriptorObject = {
        pathname: makeReplaysPathname({
          path: `/${props.item.value}/`,
          organization,
        }),
        query: {
          event_t: node.value.start_timestamp,
          referrer: 'performance.trace_view.details',
        },
      };
      return <StyledLink to={target}>{props.item.value}</StyledLink>;
    },
  };

  // Some semantic attributes are known to contain JSON-encoded arrays or
  // JSON-encoded objects. Add a JSON renderer for those attributes.
  for (const attribute of JSON_ATTRIBUTES) {
    customRenderers[attribute] = jsonRenderer;
  }

  // Some attributes (semantic or otherwise) look like they contain JSON-encoded
  // arrays. Use a JSON renderer for any value that looks suspiciously like it's
  // a JSON-encoded array. NOTE: This happens a lot because EAP doesn't support
  // array values, so SDKs often store array values as JSON-encoded strings.
  sortedAndFilteredAttributes.forEach(attribute => {
    if (Object.hasOwn(customRenderers, attribute.name)) return;
    if (attribute.type !== 'str') return;
    if (!looksLikeAJSONArray(attribute.value)) return;

    customRenderers[attribute.name] = jsonRenderer;
  });

  for (const attribute of TRUNCATED_TEXT_ATTRIBUTES) {
    customRenderers[attribute] = truncatedTextRenderer;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.SPAN_ATTRIBUTES}
      title={
        <TraceDrawerComponents.SectionTitleWithQuestionTooltip
          title={t('Attributes')}
          tooltipText={t(
            'These attributes are indexed and can be queried in the Trace Explorer.'
          )}
        />
      }
      disableCollapsePersistence
    >
      <ContentWrapper>
        <BaseSearchBar
          placeholder={t('Search')}
          onChange={query => setSearchQuery(query)}
          query={searchQuery}
          size="sm"
        />
        {sortedAndFilteredAttributes.length > 0 ? (
          <AttributesTreeWrapper>
            <AttributesTree
              columnCount={columnCount}
              attributes={sortedAndFilteredAttributes}
              renderers={customRenderers}
              rendererExtra={{
                theme,
                location,
                organization,
              }}
              getCustomActions={getTraceAttributesTreeActions({
                location,
                organization,
                projectIds: findSpanAttributeValue(attributes, 'project_id'),
              })}
            />
          </AttributesTreeWrapper>
        ) : (
          <NoAttributesMessage>
            <p>{t('No matching attributes found')}</p>
          </NoAttributesMessage>
        )}
      </ContentWrapper>
    </FoldSection>
  );
}

const StyledLink = styled(Link)`
  & div {
    display: inline;
  }
`;

const ContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  max-width: 100%;
  gap: ${space(1.5)};
`;

const AttributesTreeWrapper = styled('div')`
  padding-left: ${space(1)};
`;

const NoAttributesMessage = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: ${space(4)};
  color: ${p => p.theme.subText};
`;
