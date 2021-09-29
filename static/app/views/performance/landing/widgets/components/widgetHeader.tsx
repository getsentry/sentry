import styled from '@emotion/styled';

import {HeaderTitleLegend} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';

import {
  GenericPerformanceWidgetProps,
  WidgetDataConstraint,
  WidgetDataProps,
} from '../types';

export function WidgetHeader<T extends WidgetDataConstraint>(
  props: GenericPerformanceWidgetProps<T> & WidgetDataProps<T>
) {
  const {title, titleTooltip, subtitle, HeaderActions} = props;
  return (
    <WidgetHeaderContainer>
      <TitleContainer>
        <StyledHeaderTitleLegend data-test-id="performance-widget-title">
          {title}
          <QuestionTooltip position="top" size="sm" title={titleTooltip} />
        </StyledHeaderTitleLegend>
        <div>{subtitle ? subtitle : null}</div>
      </TitleContainer>

      {HeaderActions && (
        <HeaderActionsContainer>
          {HeaderActions && <HeaderActions {...props} />}
        </HeaderActionsContainer>
      )}
    </WidgetHeaderContainer>
  );
}

const StyledHeaderTitleLegend = styled(HeaderTitleLegend)`
  position: relative;
  z-index: initial;
`;

const TitleContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const WidgetHeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;
const HeaderActionsContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
