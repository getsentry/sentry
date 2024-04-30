import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Props = {
  spanOp: string;
  groupId: string;
  transactionName: string;
  spanDescription: string;
  avgDuration: number;
  timeSpent: number;
  spanCount: number;
};

export default function SpanSummaryHeader(props: Props) {
  const {
    groupId,
    spanOp,
    transactionName,
    spanDescription,
    avgDuration,
    timeSpent,
    spanCount,
  } = props;

  return (
    <ContentHeader>
      <HeaderInfo data-test-id="header-operation-name">
        <StyledSectionHeading>{t('Span')}</StyledSectionHeading>
        <SectionBody>
          <SpanLabelContainer>{spanDescription ?? emptyValue}</SpanLabelContainer>
        </SectionBody>
        <SectionSubtext data-test-id="operation-name">{spanOp}</SectionSubtext>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-avg-duration">
        <StyledSectionHeading>{t('Avg Duration')}</StyledSectionHeading>
        <SectionBody>
          {defined(avgDuration)
            ? formatMetricUsingUnit(avgDuration, 'milliseconds')
            : '\u2014'}
        </SectionBody>
      </HeaderInfo>
      <HeaderInfo data-test-id="header-total-exclusive-time">
        <StyledSectionHeading>{t('Time Spent')}</StyledSectionHeading>
        <SectionBody>
          {defined(timeSpent) ? (
            <PerformanceDuration abbreviation milliseconds={timeSpent} />
          ) : (
            '\u2014'
          )}
        </SectionBody>
        <SectionSubtext>
          {defined(spanCount)
            ? tct('[spanCount] spans', {spanCount: <Count value={spanCount} />})
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

export const SpanLabelContainer = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

const emptyValue = <EmptyValueContainer>{t('(unnamed span)')}</EmptyValueContainer>;
