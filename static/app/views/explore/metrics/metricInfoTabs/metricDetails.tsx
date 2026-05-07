import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {Container} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';

import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
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
import {
  isEAPTraceMeta,
  useTraceMeta,
} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';

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

  if (!traceDetailsData) {
    return (
      <MetricsDetailsWrapper ref={ref}>
        <LogDetailTableBodyCell colSpan={0} />
      </MetricsDetailsWrapper>
    );
  }

  const attributes: Record<string, TraceItemResponseAttribute['value']> = {};
  const attributeTypes: Record<string, TraceItemResponseAttribute['type']> = {};
  for (const attr of traceDetailsData.attributes) {
    attributes[attr.name] = attr.value;
    attributeTypes[attr.name] = attr.type;
  }

  return (
    <MetricsDetailsWrapper ref={ref}>
      <LogDetailTableBodyCell colSpan={0}>
        <DetailsContent>
          {showTelemetry && isEAPTraceMeta(traceMeta) ? (
            <Fragment>
              <Container>
                <pre>
                  Logs: {traceMeta?.logs} Spans: {traceMeta?.span_count} Errors:{' '}
                  {traceMeta?.errors}
                </pre>
              </Container>
              <Separator padding="md" orientation="horizontal" />
            </Fragment>
          ) : null}
          <LogAttributeTreeWrapper>
            <AttributesTree
              attributes={traceDetailsData.attributes.filter(
                attribute => !HiddenTraceMetricDetailFields.includes(attribute.name)
              )}
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
                traceItemMeta: traceDetailsData.meta,
                theme,
              }}
            />
          </LogAttributeTreeWrapper>
        </DetailsContent>
      </LogDetailTableBodyCell>
    </MetricsDetailsWrapper>
  );
}
