import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconWarning} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {LogAttributesRendererMap} from 'sentry/views/explore/logs/fieldRenderers';
import {
  DetailsBody,
  DetailsContent,
  DetailsWrapper,
  getLogColors,
  LogAttributeTreeWrapper,
  LogDetailTableBodyCell,
} from 'sentry/views/explore/logs/styles';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';
import {useMetricTraceDetail} from 'sentry/views/explore/metrics/hooks/useMetricTraceDetail';

export function TraceDetails({
  dataRow,
  ref,
}: {
  dataRow: any;
  ref: React.RefObject<HTMLTableRowElement | null>;
}) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

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
      <DetailsWrapper ref={ref}>
        <EmptyStreamWrapper>
          <IconWarning color="gray300" size="lg" />
        </EmptyStreamWrapper>
      </DetailsWrapper>
    );
  }

  return (
    <DetailsWrapper ref={isPending ? undefined : ref}>
      <LogDetailTableBodyCell colSpan={0}>
        {isPending && <LoadingIndicator />}
        {!isPending && data && (
          <Fragment>
            <DetailsContent>
              <DetailsBody>
                {tct('Trace: [traceId]', {traceId: getShortEventId(dataRow.trace)})}
              </DetailsBody>
              <LogAttributeTreeWrapper>
                <AttributesTree
                  attributes={data.attributes}
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
    </DetailsWrapper>
  );
}
