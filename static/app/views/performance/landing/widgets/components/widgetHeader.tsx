import styled from '@emotion/styled';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';

import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import {TextOverflow} from 'sentry/components/textOverflow';
import {MEPTag} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import type {
  GenericPerformanceWidgetProps,
  WidgetDataConstraint,
  WidgetDataProps,
} from 'sentry/views/performance/landing/widgets/types';

export function WidgetHeader<T extends WidgetDataConstraint>(
  props: GenericPerformanceWidgetProps<T> & WidgetDataProps<T>
) {
  const {title, Subtitle, HeaderActions, InteractiveTitle} = props;

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
  top: -${p => p.theme.space.xs};

  ${FeatureBadge} {
    position: relative;
    top: -${p => p.theme.space['2xs']};
    margin-left: ${p => p.theme.space['2xs']};
  }
`;
