import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {LogAttributesRendererMap} from 'sentry/views/explore/logs/fieldRenderers';
import {
  getLogColors,
  LogAttributeTreeWrapper,
  LogDetailTableBodyCell,
} from 'sentry/views/explore/logs/styles';
import {useLogAttributesTreeActions} from 'sentry/views/explore/logs/useLogAttributesTreeActions';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';
import {HiddenTraceMetricDetailFields} from 'sentry/views/explore/metrics/constants';
import {useMetricTraceDetail} from 'sentry/views/explore/metrics/hooks/useMetricTraceDetail';
import {
  DetailsContent,
  MetricsDetailsWrapper,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricEventsResponseItem,
} from 'sentry/views/explore/metrics/types';
import type {
  EAPTraceMeta,
  TraceMeta,
} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import {
  isEAPTraceMeta,
  useTraceMeta,
} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';

function MetricDetailsEmptyState({children}: {children: React.ReactNode}) {
  return (
    <Stack align="center" paddingBottom="sm">
      <Text variant="muted">{children}</Text>
    </Stack>
  );
}

export function MetricDetails({
  dataRow,
  ref,
  showTelemetry,
}: {
  dataRow: TraceMetricEventsResponseItem;
  ref: React.RefObject<HTMLTableRowElement | null>;
  showTelemetry: boolean;
}) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const getActions = useLogAttributesTreeActions({embedded: false});
  const project = useProjectFromId({
    project_id: String(dataRow[TraceMetricKnownFieldKey.PROJECT_ID] ?? ''),
  });
  const projectSlug = project?.slug ?? '';

  const enableQueries =
    defined(dataRow[TraceMetricKnownFieldKey.ID]) &&
    defined(dataRow[TraceMetricKnownFieldKey.PROJECT_ID]) &&
    defined(dataRow[TraceMetricKnownFieldKey.TRACE]);

  const {
    data: traceDetailsData,
    isPending,
    isError,
  } = useMetricTraceDetail({
    metricId: String(dataRow[TraceMetricKnownFieldKey.ID] ?? ''),
    projectId: String(dataRow[TraceMetricKnownFieldKey.PROJECT_ID] ?? ''),
    traceId: String(dataRow[TraceMetricKnownFieldKey.TRACE] ?? ''),
    enabled: enableQueries,
  });

  const traceSlug = String(dataRow[TraceMetricKnownFieldKey.TRACE] ?? '');
  const timestamp = getTimeStampFromTableDateField(
    dataRow[TraceMetricKnownFieldKey.TIMESTAMP]
  );
  const {data: traceMeta, isLoading: isTraceMetaLoading} = useTraceMeta(
    enableQueries && showTelemetry ? [{traceSlug, timestamp}] : []
  );

  if (isError) {
    return (
      <MetricsDetailsWrapper ref={ref}>
        <EmptyStreamWrapper>
          <IconWarning variant="muted" size="lg" />
        </EmptyStreamWrapper>
      </MetricsDetailsWrapper>
    );
  }

  if (isPending || (isTraceMetaLoading && showTelemetry)) {
    return (
      <MetricsDetailsWrapper ref={ref}>
        <LogDetailTableBodyCell colSpan={0}>
          <LoadingIndicator />
        </LogDetailTableBodyCell>
      </MetricsDetailsWrapper>
    );
  }

  const attributes: Record<string, TraceItemResponseAttribute['value']> = {};
  const attributeTypes: Record<string, TraceItemResponseAttribute['type']> = {};
  for (const attr of traceDetailsData?.attributes ?? []) {
    attributes[attr.name] = attr.value;
    attributeTypes[attr.name] = attr.type;
  }
  const visibleAttributes =
    traceDetailsData?.attributes?.filter(
      attribute => !HiddenTraceMetricDetailFields.includes(attribute.name)
    ) ?? [];

  return (
    <MetricsDetailsWrapper ref={ref}>
      <LogDetailTableBodyCell colSpan={0}>
        <DetailsContent>
          {showTelemetry ? <MetricDetailsTraceSummary traceMeta={traceMeta} /> : null}
          <LogAttributeTreeWrapper>
            <Stack gap="md">
              <Text bold>Attributes</Text>
              {visibleAttributes.length > 0 ? (
                <AttributesTree
                  attributes={visibleAttributes}
                  getCustomActions={getActions}
                  renderers={LogAttributesRendererMap}
                  rendererExtra={{
                    attributes,
                    attributeTypes,
                    caseSensitiveHighlighting: false,
                    highlightTerms: [],
                    logColors: getLogColors(SeverityLevel.INFO, theme),
                    location,
                    organization,
                    projectSlug,
                    project,
                    traceItemMeta: traceDetailsData?.meta,
                    theme,
                  }}
                />
              ) : (
                <MetricDetailsEmptyState>
                  {t('No attributes found for this sample')}
                </MetricDetailsEmptyState>
              )}
            </Stack>
          </LogAttributeTreeWrapper>
        </DetailsContent>
      </LogDetailTableBodyCell>
    </MetricsDetailsWrapper>
  );
}

function MetricDetailsTraceSummary({
  traceMeta,
}: {
  traceMeta: TraceMeta | EAPTraceMeta | undefined;
}) {
  if (isEAPTraceMeta(traceMeta)) {
    return (
      <Fragment>
        <Stack paddingLeft="md" paddingRight="md" paddingTop="sm">
          <Text bold>Trace Summary</Text>
          <Flex radius="md" paddingRight="lg" paddingTop="sm" gap="lg">
            <Text size="sm" monospace variant="secondary">
              Errors: {traceMeta?.errors}, Logs: {traceMeta?.logs}, Spans:{' '}
              {traceMeta?.span_count}
            </Text>
          </Flex>
        </Stack>
        <Separator padding="sm" orientation="horizontal" />
      </Fragment>
    );
  }

  return (
    <MetricDetailsEmptyState>
      {t('No trace summary found for this sample')}
    </MetricDetailsEmptyState>
  );
}
