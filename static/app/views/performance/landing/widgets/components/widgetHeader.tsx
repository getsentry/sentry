import styled from '@emotion/styled';

import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import FeatureBadge from 'sentry/components/core/badge/featureBadge';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import {MEPTag} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';

import type {
  GenericPerformanceWidgetProps,
  WidgetDataConstraint,
  WidgetDataProps,
} from '../types';

export function WidgetHeader<T extends WidgetDataConstraint>(
  props: GenericPerformanceWidgetProps<T> & WidgetDataProps<T>
) {
  const {title, titleTooltip, Subtitle, HeaderActions, InteractiveTitle} = props;

  return (
    <WidgetHeaderContainer>
      <TitleContainer>
        <StyledHeaderTitleLegend data-test-id="performance-widget-title">
          {InteractiveTitle ? (
            <InteractiveTitle {...props} />
          ) : (
            <TextOverflow>{title}</TextOverflow>
          )}
          <MEPTag />
          {titleTooltip && (
            <QuestionTooltip position="top" size="sm" title={titleTooltip} />
          )}
        </StyledHeaderTitleLegend>
        {Subtitle ? <Subtitle {...props} /> : null}
      </TitleContainer>
      <HeaderActionsContainer>
        {HeaderActions && <HeaderActions {...props} />}
      </HeaderActionsContainer>
    </WidgetHeaderContainer>
  );
}

const StyledHeaderTitleLegend = styled(HeaderTitleLegend)`
  position: relative;
  z-index: initial;
  top: -${space(0.5)};

  ${FeatureBadge} {
    position: relative;
    top: -${space(0.25)};
    margin-left: ${space(0.25)};
  }
`;

const TitleContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const WidgetHeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(1)};
`;

const HeaderActionsContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
