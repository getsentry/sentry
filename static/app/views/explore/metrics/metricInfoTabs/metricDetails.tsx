import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
import {useMetricAttributesTreeActions} from 'sentry/views/explore/metrics/useMetricAttributesTreeActions';
import type {
  EAPTraceMeta,
  TraceMeta,
} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import {
  getTraceMetaErrorCount,
  getTraceMetaLogsCount,
  getTraceMetaMetricsCount,
  getTraceMetaSpanCount,
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
  const navigate = useNavigate();
  const organization = useOrganization();
  const getActions = useMetricAttributesTreeActions();
  const project = useProjectFromId({
    project_id: String(dataRow[TraceMetricKnownFieldKey.PROJECT_ID] ?? ''),
  });
  const projectSlug = project?.slug ?? '';

  const enableQueries =
    defined(dataRow[TraceMetricKnownFieldKey.ID]) &&
    defined(dataRow[TraceMetricKnownFieldKey.PROJECT_ID]) &&
    defined(dataRow[TraceMetricKnownFieldKey.TRACE]);
  const timestamp = getTimeStampFromTableDateField(
    dataRow[TraceMetricKnownFieldKey.TIMESTAMP]
  );

  const {
    data: traceDetailsData,
    isLoading: isTraceDetailsLoading,
    isError,
  } = useMetricTraceDetail({
    metricId: String(dataRow[TraceMetricKnownFieldKey.ID] ?? ''),
    projectId: String(dataRow[TraceMetricKnownFieldKey.PROJECT_ID] ?? ''),
    traceId: String(dataRow[TraceMetricKnownFieldKey.TRACE] ?? ''),
    timestamp,
    enabled: enableQueries,
  });

  const traceSlug = String(dataRow[TraceMetricKnownFieldKey.TRACE] ?? '');
  const {
    data: traceMeta,
    isLoading: isTraceMetaLoading,
    errors: traceMetaErrors,
  } = useTraceMeta(enableQueries && showTelemetry ? [{traceSlug, timestamp}] : []);

  if (isError) {
    return (
      <MetricsDetailsWrapper ref={ref}>
        <LogDetailTableBodyCell colSpan={0}>
          <EmptyStreamWrapper>
            <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
          </EmptyStreamWrapper>
        </LogDetailTableBodyCell>
      </MetricsDetailsWrapper>
    );
  }

  if (isTraceDetailsLoading || (isTraceMetaLoading && showTelemetry)) {
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
          {showTelemetry ? (
            <MetricDetailsTraceSummary
              traceMeta={traceMeta}
              traceMetaErrors={traceMetaErrors}
            />
          ) : null}
          <LogAttributeTreeWrapper>
            <Stack gap="md">
              <Text bold>{t('Attributes')}</Text>
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
                    navigate,
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
  traceMetaErrors,
}: {
  traceMeta: TraceMeta | EAPTraceMeta | undefined;
  traceMetaErrors: Error[];
}) {
  return (
    <Fragment>
      <Stack paddingLeft="md" paddingRight="md" paddingTop="sm">
        <Text bold>{t('Trace Summary')}</Text>
        <Flex radius="md" paddingRight="lg" paddingTop="sm" gap="lg">
          <MetricDetailsTraceSummaryContent
            traceMeta={traceMeta}
            traceMetaErrors={traceMetaErrors}
          />
        </Flex>
      </Stack>
      <Separator padding="sm" orientation="horizontal" />
    </Fragment>
  );
}

function MetricDetailsTraceSummaryContent({
  traceMeta,
  traceMetaErrors,
}: {
  traceMeta: TraceMeta | EAPTraceMeta | undefined;
  traceMetaErrors: Error[];
}) {
  if (traceMetaErrors.length > 0) {
    return (
      <Text size="sm" monospace variant="danger">
        {t('Failed to fetch trace summary')}
      </Text>
    );
  }

  if (!traceMeta) {
    return (
      <Text size="sm" monospace variant="muted">
        {t('No trace summary found for this sample')}
      </Text>
    );
  }

  const errors = getTraceMetaErrorCount(traceMeta) ?? 0;
  const logs = getTraceMetaLogsCount(traceMeta) ?? 0;
  const spans = getTraceMetaSpanCount(traceMeta) ?? 0;
  const metrics = getTraceMetaMetricsCount(traceMeta) ?? 0;

  return (
    <Text size="sm" monospace variant="secondary">
      {tct('Errors: [errors], Logs: [logs], Spans: [spans], Metrics: [metrics]', {
        errors,
        logs,
        spans,
        metrics,
      })}
    </Text>
  );
}
