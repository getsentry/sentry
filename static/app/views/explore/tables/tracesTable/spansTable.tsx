import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import Count from 'sentry/components/count';
import {EmptyStreamWrapper} from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useExploreDataset,
  useExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';
import type {TraceResult} from 'sentry/views/explore/hooks/useTraces';
import {type SpanResult, useTraceSpans} from 'sentry/views/explore/hooks/useTraceSpans';
import {type Field, FIELDS, SORTS} from 'sentry/views/explore/tables/tracesTable/data';
import {
  SpanBreakdownSliceRenderer,
  SpanDescriptionRenderer,
  SpanIdRenderer,
  SpanTimeRenderer,
  TraceBreakdownContainer,
} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import {
  MoreMatchingSpans,
  SpanPanelContent,
  SpanTablePanelItem,
  StyledPanel,
  StyledPanelHeader,
  StyledPanelItem,
  StyledSpanPanelItem,
} from 'sentry/views/explore/tables/tracesTable/styles';
import {getSecondaryNameFromSpan} from 'sentry/views/explore/tables/tracesTable/utils';

const ONE_MINUTE = 60 * 1000; // in milliseconds

export function SpanTable({trace}: {trace: TraceResult}) {
  const organization = useOrganization();

  const dataset = useExploreDataset();
  const query = useExploreQuery();

  const {data, isPending, isError} = useTraceSpans({
    dataset,
    trace,
    fields: [
      ...FIELDS,
      ...SORTS.map(field =>
        field.startsWith('-') ? (field.substring(1) as Field) : (field as Field)
      ),
    ],
    datetime: {
      // give a 1 minute buffer on each side so that start != end
      start: getUtcDateString(moment(trace.start - ONE_MINUTE)),
      end: getUtcDateString(moment(trace.end + ONE_MINUTE)),
      period: null,
      utc: true,
    },
    limit: 10,
    query,
    sort: SORTS,
  });

  const spans = useMemo(() => data?.data ?? [], [data]);

  const showErrorState = useMemo(() => {
    return !isPending && isError;
  }, [isPending, isError]);

  const hasData = useMemo(() => {
    return !isPending && !showErrorState && spans.length > 0;
  }, [spans, isPending, showErrorState]);

  return (
    <SpanTablePanelItem span={6} overflow>
      <StyledPanel>
        <SpanPanelContent>
          <StyledPanelHeader align="left" lightText>
            {t('Span ID')}
          </StyledPanelHeader>
          <StyledPanelHeader align="left" lightText>
            {t('Span Description')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText />
          <StyledPanelHeader align="right" lightText>
            {t('Span Duration')}
          </StyledPanelHeader>
          <StyledPanelHeader align="right" lightText>
            {t('Timestamp')}
          </StyledPanelHeader>
          {isPending && (
            <StyledPanelItem span={5} overflow>
              <LoadingIndicator />
            </StyledPanelItem>
          )}
          {isError && ( // TODO: need an error state
            <StyledPanelItem span={5} overflow>
              <EmptyStreamWrapper>
                <IconWarning color="gray300" size="lg" />
              </EmptyStreamWrapper>
            </StyledPanelItem>
          )}
          {data?.data.map(span => (
            <SpanRow
              organization={organization}
              key={span.id}
              span={span}
              trace={trace}
            />
          ))}
          {hasData && spans.length < trace.matchingSpans && (
            <MoreMatchingSpans span={5}>
              {tct('[more][space]more [matching]spans can be found in the trace.', {
                more: <Count value={trace.matchingSpans - spans.length} />,
                space: <Fragment>&nbsp;</Fragment>,
                matching: query ? 'matching ' : '',
              })}
            </MoreMatchingSpans>
          )}
        </SpanPanelContent>
      </StyledPanel>
    </SpanTablePanelItem>
  );
}

function SpanRow({
  organization,
  span,
  trace,
}: {
  organization: Organization;
  span: SpanResult<Field>;

  trace: TraceResult;
}) {
  const theme = useTheme();
  return (
    <Fragment>
      <StyledSpanPanelItem align="right">
        <SpanIdRenderer
          projectSlug={span.project}
          transactionId={span['transaction.id']}
          spanId={span.id}
          traceId={trace.trace}
          timestamp={span.timestamp}
          onClick={() =>
            trackAnalytics('trace_explorer.open_trace_span', {
              organization,
              source: 'new explore',
            })
          }
        />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="left" overflow>
        <SpanDescriptionRenderer span={span} />
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right">
        <TraceBreakdownContainer>
          <SpanBreakdownSliceRenderer
            sliceName={span.project}
            sliceSecondaryName={getSecondaryNameFromSpan(span)}
            sliceStart={Math.ceil(span['precise.start_ts'] * 1000)}
            sliceEnd={Math.floor(span['precise.finish_ts'] * 1000)}
            trace={trace}
            theme={theme}
          />
        </TraceBreakdownContainer>
      </StyledSpanPanelItem>
      <StyledSpanPanelItem align="right">
        <PerformanceDuration milliseconds={span['span.duration']} abbreviation />
      </StyledSpanPanelItem>

      <StyledSpanPanelItem align="right">
        <SpanTimeRenderer
          timestamp={span['precise.finish_ts'] * 1000}
          tooltipShowSeconds
        />
      </StyledSpanPanelItem>
    </Fragment>
  );
}
