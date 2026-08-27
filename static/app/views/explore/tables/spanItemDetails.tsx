import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import type {EventData} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {FieldKey} from 'sentry/utils/fields';
import {formatDollars} from 'sentry/utils/formatters';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {
  AttributesFieldRendererProps,
  AttributesTreeContent,
} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {useAttributeTreeSearchActions} from 'sentry/views/explore/components/traceItemAttributes/useAttributeTreeSearchActions';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useSetQueryParamsFields,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SpanFields} from 'sentry/views/insights/types';
import {sortAttributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const HIDDEN_SPAN_DETAIL_ATTRIBUTES = new Set(['is_segment', 'project_id', 'received']);

type SpanAttributesRendererExtra = RenderFunctionBaggage & {
  spanId: string;
  timestamp?: number;
};

type SpanAttributeRenderer = (
  props: AttributesFieldRendererProps<SpanAttributesRendererExtra>
) => React.ReactNode;

export function SpanItemDetails({dataRow}: {dataRow: EventData}) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const getActions = useSpanAttributesTreeActions();

  const spanId = String(dataRow.id ?? '');
  const traceId = String(dataRow.trace ?? '');
  const projectSlug = String(dataRow.project ?? '');
  const project = projects.find(candidate => candidate.slug === projectSlug);
  const timestamp = getTimeStampFromTableDateField(dataRow.timestamp);
  const canLoadDetails = Boolean(spanId && traceId && project);
  const dateSelection = useMemo(
    () => normalizeDateTimeParams(selection.datetime),
    [selection.datetime]
  );

  const {data, isError, isLoading, refetch} = useTraceItemDetails({
    traceItemId: spanId,
    projectId: project?.id ?? '',
    traceId,
    timestamp,
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.span-item-details',
    enabled: canLoadDetails,
  });

  const renderers = useSpanAttributeRenderers({
    location,
    organization,
    projectSlug,
    spanId,
    timestamp,
    dateSelection,
  });

  const visibleAttributes = useMemo(
    () =>
      sortAttributes(
        (data?.attributes ?? []).filter(
          attribute => !HIDDEN_SPAN_DETAIL_ATTRIBUTES.has(attribute.name)
        )
      ),
    [data?.attributes]
  );

  if (isLoading) {
    return (
      <SpanItemDetailsContainer>
        <Flex align="center" justify="center" minHeight="100px">
          <LoadingIndicator />
        </Flex>
      </SpanItemDetailsContainer>
    );
  }

  if (isError || !canLoadDetails) {
    return (
      <SpanItemDetailsContainer>
        <LoadingError
          message={t('Failed to load span details')}
          onRetry={canLoadDetails ? () => void refetch() : undefined}
        />
      </SpanItemDetailsContainer>
    );
  }

  if (visibleAttributes.length === 0) {
    return (
      <SpanItemDetailsContainer>
        <Flex align="center" justify="center" padding="xl">
          <Text variant="muted">{t('No attributes found for this span')}</Text>
        </Flex>
      </SpanItemDetailsContainer>
    );
  }

  return (
    <SpanItemDetailsContainer>
      <AttributesTree<SpanAttributesRendererExtra>
        attributes={visibleAttributes}
        getCustomActions={getActions}
        renderers={renderers}
        rendererExtra={{
          location,
          navigate,
          organization,
          projectSlug,
          spanId,
          theme,
          timestamp,
          traceItemMeta: data?.meta,
        }}
      />
    </SpanItemDetailsContainer>
  );
}

function SpanItemDetailsContainer({children}: {children: React.ReactNode}) {
  return (
    <Container background="primary" border="primary" radius="md" padding="md">
      {children}
    </Container>
  );
}

function useSpanAttributesTreeActions() {
  const getSearchActions = useAttributeTreeSearchActions();
  const fields = useQueryParamsFields();
  const setFields = useSetQueryParamsFields();
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();

  return useCallback(
    (content: AttributesTreeContent) => {
      const attribute = content.originalAttribute;
      if (!attribute) {
        return [];
      }

      const key = attribute.original_attribute_key;
      const actions = getSearchActions(content);

      actions.push(
        {
          key: 'add-column',
          label: t('Add this as table column'),
          disabled: fields.includes(key),
          onAction: () => setFields([...fields, key]),
        },
        {
          key: 'add-group-by',
          label: t('Group by attribute'),
          disabled: groupBys.includes(key),
          onAction: () => setGroupBys([...groupBys.filter(Boolean), key], Mode.AGGREGATE),
        }
      );

      return actions;
    },
    [fields, getSearchActions, groupBys, setFields, setGroupBys]
  );
}

function useSpanAttributeRenderers({
  dateSelection,
  location,
  organization,
  projectSlug,
  spanId,
  timestamp,
}: {
  dateSelection: ReturnType<typeof normalizeDateTimeParams>;
  location: ReturnType<typeof useLocation>;
  organization: ReturnType<typeof useOrganization>;
  projectSlug: string;
  spanId: string;
  timestamp?: number;
}): Record<string, SpanAttributeRenderer> {
  return useMemo(() => {
    const profileRenderer: SpanAttributeRenderer = ({item, basicRendered}) => {
      if (
        !organization ||
        !projectSlug ||
        typeof item.value !== 'string' ||
        !item.value
      ) {
        return basicRendered;
      }

      return (
        <Link
          to={{
            pathname: generateProfileFlamechartRoute({
              organization,
              projectSlug,
              profileId: item.value,
            }),
            query: {spanId},
          }}
        >
          {basicRendered}
        </Link>
      );
    };

    const replayRenderer: SpanAttributeRenderer = ({item, basicRendered}) => {
      if (!organization || typeof item.value !== 'string' || !item.value) {
        return basicRendered;
      }

      return (
        <Link
          to={{
            pathname: makeReplaysPathname({
              path: `/${item.value}/`,
              organization,
            }),
            query: {
              event_t: timestamp,
              referrer: 'trace_explorer.span_samples',
            },
          }}
        >
          {basicRendered}
        </Link>
      );
    };

    const costRenderer: SpanAttributeRenderer = ({item, basicRendered}) => {
      const value = Number(item.value);
      return Number.isFinite(value) ? formatDollars(+value.toFixed(10)) : basicRendered;
    };

    return {
      [FieldKey.PROFILE_ID]: profileRenderer,
      [SpanFields.PROFILE_ID]: profileRenderer,
      [FieldKey.TRACE]: ({item, basicRendered}) => {
        if (!organization || typeof item.value !== 'string' || !item.value) {
          return basicRendered;
        }

        const target = getTraceDetailsUrl({
          organization,
          traceSlug: item.value,
          spanId,
          timestamp,
          dateSelection,
          location,
          source: TraceViewSources.TRACES,
        });
        return <Link to={target}>{basicRendered}</Link>;
      },
      [FieldKey.REPLAY_ID]: replayRenderer,
      [SpanFields.REPLAY_ID]: replayRenderer,
      [SpanFields.GEN_AI_COST_INPUT_TOKENS]: costRenderer,
      [SpanFields.GEN_AI_COST_OUTPUT_TOKENS]: costRenderer,
      [SpanFields.GEN_AI_COST_TOTAL_TOKENS]: costRenderer,
    };
  }, [dateSelection, location, organization, projectSlug, spanId, timestamp]);
}
