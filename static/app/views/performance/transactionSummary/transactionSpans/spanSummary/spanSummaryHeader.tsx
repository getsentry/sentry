import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {formatMetricUsingUnit} from 'sentry/utils/number/formatMetricUsingUnit';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';

type Props = {
  avgDuration: number | undefined;
  spanCount: number | undefined;
  spanDescription: string | undefined;
  spanOp: string | undefined;
  timeSpent: number | undefined;
};

export default function SpanSummaryHeader(props: Props) {
  const {spanOp, spanDescription, avgDuration, timeSpent, spanCount} = props;

  return (
    <ContentHeader>
      <HeaderInfo data-test-id="header-operation-name">
        <StyledSectionHeading>{t('Span')}</StyledSectionHeading>
        <SectionBody>
          <SpanLabelContainer data-test-id="header-span-description">
            {spanDescription ? spanDescription : emptyValue}
          </SpanLabelContainer>
        </SectionBody>
        <SectionSubtext data-test-id="operation-name">
          {spanOp ? spanOp : emptyValue}
        </SectionSubtext>
      </HeaderInfo>

      <HeaderInfo data-test-id="header-avg-duration">
        <StyledSectionHeading>{DataTitles.avg}</StyledSectionHeading>
        <NumericSectionWrapper>
          <SectionBody>
            {defined(avgDuration)
              ? formatMetricUsingUnit(avgDuration, 'milliseconds')
              : '\u2014'}
          </SectionBody>
        </NumericSectionWrapper>
      </HeaderInfo>

      <HeaderInfo data-test-id="header-total-time-spent">
        <StyledSectionHeading>{DataTitles.timeSpent}</StyledSectionHeading>
        <NumericSectionWrapper>
          <SectionBody>
            {defined(timeSpent) ? (
              <PerformanceDuration abbreviation milliseconds={timeSpent} />
            ) : (
              '\u2014'
            )}
          </SectionBody>
          <SectionSubtext data-test-id="total-span-count">
            {defined(spanCount)
              ? tct('[spanCount] spans', {spanCount: <Count value={spanCount} />})
              : '\u2014'}
          </SectionSubtext>
        </NumericSectionWrapper>
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

const NumericSectionWrapper = styled('div')`
  text-align: right;
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

const emptyValue = <EmptyValueContainer>{'\u2014'}</EmptyValueContainer>;
