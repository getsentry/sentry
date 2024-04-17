import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';

export default function SpanSummaryHeader() {
  // const {spanSlug, suspectSpan, totalCount} = props;

  const {spanSlug} = useParams();
  const [spanOp, groupId] = spanSlug.split(':');

  const location = useLocation();
  const {transaction} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transaction as string,
  };

  const {
    isLoading: isPercentileDataLoading,
    data: percentileData,
    error: percentileDataError,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      'span.description',
      'p50(span.self_time)',
      'p75(span.self_time)',
      'p95(span.self_time)',
      'p99(span.self_time)',
    ],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page',
  });

  // Break these fields into a second request, since they take longer to fetch
  const {
    isLoading: isSecondaryDataLoading,
    data: secondaryData,
    error: secondaryDataError,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: ['avg(span.self_time)', 'sum(span.self_time)', 'count()'],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page',
  });

  console.dir(percentileData);
  console.dir(secondaryData);

  const description = percentileData[0]?.['span.description'] ?? t('unknown');
  const p50ExclusiveTime = percentileData[0]?.['p50(span.self_time)'];
  const p75ExclusiveTime = percentileData[0]?.['p75(span.self_time)'];
  const p95ExclusiveTime = percentileData[0]?.['p95(span.self_time)'];
  const p99ExclusiveTime = percentileData[0]?.['p99(span.self_time)'];

  const sumExclusiveTime = secondaryData[0]?.['sum(span.self_time)'];
  const avgDuration = secondaryData[0]?.['avg(span.self_time)'];

  return (
    <ContentHeader>
      <HeaderInfo data-test-id="header-operation-name">
        <StyledSectionHeading>{t('Span')}</StyledSectionHeading>
        <SectionBody>
          <SpanLabelContainer>{description ?? emptyValue}</SpanLabelContainer>
        </SectionBody>
        <SectionSubtext data-test-id="operation-name">{spanOp}</SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-percentiles">
        <StyledSectionHeading>{t('Self Time Percentiles')}</StyledSectionHeading>
        <PercentileHeaderBodyWrapper>
          <div data-test-id="section-p50">
            <SectionBody>
              {defined(p50ExclusiveTime) ? (
                <PerformanceDuration abbreviation milliseconds={p50ExclusiveTime} />
              ) : (
                '\u2014'
              )}
            </SectionBody>
            <SectionSubtext>{t('p50')}</SectionSubtext>
          </div>
          <div data-test-id="section-p75">
            <SectionBody>
              {defined(p75ExclusiveTime) ? (
                <PerformanceDuration abbreviation milliseconds={p75ExclusiveTime} />
              ) : (
                '\u2014'
              )}
            </SectionBody>
            <SectionSubtext>{t('p75')}</SectionSubtext>
          </div>
          <div data-test-id="section-p95">
            <SectionBody>
              {defined(p95ExclusiveTime) ? (
                <PerformanceDuration abbreviation milliseconds={p95ExclusiveTime} />
              ) : (
                '\u2014'
              )}
            </SectionBody>
            <SectionSubtext>{t('p95')}</SectionSubtext>
          </div>
          <div data-test-id="section-p99">
            <SectionBody>
              {defined(p99ExclusiveTime) ? (
                <PerformanceDuration abbreviation milliseconds={p99ExclusiveTime} />
              ) : (
                '\u2014'
              )}
            </SectionBody>
            <SectionSubtext>{t('p99')}</SectionSubtext>
          </div>
        </PercentileHeaderBodyWrapper>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-avg-duration">
        <StyledSectionHeading>{t('Avg Duration')}</StyledSectionHeading>
        <SectionBody>
          {defined(avgDuration)
            ? formatMetricUsingUnit(avgDuration, 'milliseconds') // formatPercentage(Math.min(frequency, totalCount) / totalCount)
            : '\u2014'}
        </SectionBody>
        <SectionSubtext>
          {'XX'}
          {/* {defined(avgOccurrences)
            ? tct('[times] times per event', {times: avgOccurrences.toFixed(2)})
            : '\u2014'} */}
        </SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-total-exclusive-time">
        <StyledSectionHeading>{t('Total Self Time')}</StyledSectionHeading>
        <SectionBody>
          {defined(sumExclusiveTime) ? (
            <PerformanceDuration abbreviation milliseconds={sumExclusiveTime} />
          ) : (
            '\u2014'
          )}
        </SectionBody>
        <SectionSubtext>
          {defined(100)
            ? tct('[events] events', {events: <Count value={100} />})
            : '\u2014'}
        </SectionSubtext>
      </HeaderInfo>
    </ContentHeader>
  );
}

const ContentHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(4)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr repeat(3, max-content);
  }
`;

const HeaderInfo = styled('div')`
  ${p => p.theme.overflowEllipsis};
  height: 78px;
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin: 0;
`;

const SectionBody = styled('div')<{overflowEllipsis?: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: ${space(0.5)} 0;
  max-height: 32px;
`;

const SectionSubtext = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const PercentileHeaderBodyWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, max-content);
  gap: ${space(3)};
`;

export const SpanLabelContainer = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

const emptyValue = <EmptyValueContainer>{t('(unnamed span)')}</EmptyValueContainer>;
