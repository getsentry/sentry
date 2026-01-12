import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import {MEPTag} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import type {
  GenericPerformanceWidgetProps,
  WidgetDataConstraint,
  WidgetDataProps,
} from 'sentry/views/performance/landing/widgets/types';

export function WidgetHeader<T extends WidgetDataConstraint>(
  props: GenericPerformanceWidgetProps<T> & WidgetDataProps<T>
) {
  const {title, titleTooltip, Subtitle, HeaderActions, InteractiveTitle} = props;

  return (
    <Flex justify="between" align="start" gap="md">
      <Stack align="start">
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
      </Stack>
      <Flex align="center" gap="md">
        {HeaderActions && <HeaderActions {...props} />}
      </Flex>
    </Flex>
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
