import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
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

export function MetricDetails({
  dataRow,
  ref,
}: {
  dataRow: any;
  ref: React.RefObject<HTMLTableRowElement | null>;
}) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const getActions = useLogAttributesTreeActions({embedded: false});

  const traceDetailResult = useMetricTraceDetail({
    metricId: String(dataRow.id ?? ''),
    projectId: String(dataRow['project.id'] ?? ''),
    traceId: String(dataRow.trace ?? ''),
    enabled:
      defined(dataRow.id) && defined(dataRow['project.id']) && defined(dataRow.trace),
  });

  const {data, isPending, isError} = traceDetailResult;

  if (isError) {
    return (
      <MetricsDetailsWrapper ref={ref}>
        <EmptyStreamWrapper>
          <IconWarning color="gray300" size="lg" />
        </EmptyStreamWrapper>
      </MetricsDetailsWrapper>
    );
  }

  return (
    <MetricsDetailsWrapper ref={isPending ? undefined : ref}>
      <LogDetailTableBodyCell colSpan={0}>
        {isPending && <LoadingIndicator />}
        {!isPending && data && (
          <Fragment>
            <DetailsContent>
              <LogAttributeTreeWrapper>
                <AttributesTree
                  attributes={data.attributes.filter(
                    attribute => !HiddenTraceMetricDetailFields.includes(attribute.name)
                  )}
                  getCustomActions={getActions}
                  renderers={LogAttributesRendererMap}
                  rendererExtra={{
                    attributeTypes: {},
                    attributes: {},
                    highlightTerms: [],
                    logColors: getLogColors(SeverityLevel.INFO, theme),
                    location,
                    organization,
                    theme,
                  }}
                />
              </LogAttributeTreeWrapper>
            </DetailsContent>
          </Fragment>
        )}
      </LogDetailTableBodyCell>
    </MetricsDetailsWrapper>
  );
}
