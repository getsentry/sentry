import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import {SpanSlug, SuspectSpan} from 'sentry/utils/performance/suspectSpans/types';

interface HeaderProps {
  spanSlug: SpanSlug;
  totalCount: number | null;
  suspectSpan?: SuspectSpan;
}

export default function SpanDetailsHeader(props: HeaderProps) {
  const {spanSlug, suspectSpan, totalCount} = props;

  const {
    description,
    frequency,
    avgOccurrences,
    p75ExclusiveTime,
    p95ExclusiveTime,
    p99ExclusiveTime,
    sumExclusiveTime,
  } = suspectSpan ?? {};

  return (
    <ContentHeader>
      <HeaderInfo data-test-id="header-operation-name">
        <StyledSectionHeading>{t('Span Operation')}</StyledSectionHeading>
        <SectionBody>
          <SpanLabelContainer>{description ?? emptyValue}</SpanLabelContainer>
        </SectionBody>
        <SectionSubtext data-test-id="operation-name">{spanSlug.op}</SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-percentiles">
        <StyledSectionHeading>{t('Self Time Percentiles')}</StyledSectionHeading>
        <PercentileHeaderBodyWrapper>
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
      <HeaderInfo data-test-id="header-frequency">
        <StyledSectionHeading>{t('Frequency')}</StyledSectionHeading>
        <SectionBody>
          {defined(frequency) && defined(totalCount)
            ? formatPercentage(Math.min(frequency, totalCount) / totalCount)
            : '\u2014'}
        </SectionBody>
        <SectionSubtext>
          {defined(avgOccurrences)
            ? tct('[times] times per event', {times: avgOccurrences.toFixed(2)})
            : '\u2014'}
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
          {defined(frequency)
            ? tct('[events] events', {events: <Count value={frequency} />})
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

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr repeat(3, max-content);
  }
`;

const HeaderInfo = styled('div')`
  ${overflowEllipsis};
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
  grid-template-columns: repeat(3, max-content);
  gap: ${space(3)};
`;

export const SpanLabelContainer = styled('div')`
  ${overflowEllipsis};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

const emptyValue = <EmptyValueContainer>{t('(unnamed span)')}</EmptyValueContainer>;
