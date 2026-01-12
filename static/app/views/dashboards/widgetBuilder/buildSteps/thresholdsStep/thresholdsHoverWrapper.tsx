import type React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import CircleIndicator from 'sentry/components/circleIndicator';
import {Hovercard} from 'sentry/components/hovercard';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {ThresholdsConfig} from './thresholds';

type Props = {
  children: React.ReactNode;
  thresholds: ThresholdsConfig;
  type?: string;
};

const NEGATIVE_POLARITY_COLOR_ORDER = ['green400', 'yellow400', 'red400'] as const;
const POSITIVE_POLARITY_COLOR_ORDER = ['red400', 'yellow400', 'green400'] as const;

export function ThresholdsHoverWrapper({children, thresholds, type}: Props) {
  const {
    unit,
    max_values: {max1, max2},
  } = thresholds;
  const theme = useTheme();
  const formattedUnit =
    unit && (type === 'duration' ? `${unit}s` : `/${unit.split('/')[1]}`);
  const title = unit ? t(`Thresholds in %s`, formattedUnit) : t('Thresholds');

  const notSetMsg = t('Not set');
  const maxOneValue = max1 ?? notSetMsg;
  const maxTwoValue = max2 ?? notSetMsg;

  const colorOrder =
    thresholds.preferredPolarity === '+'
      ? POSITIVE_POLARITY_COLOR_ORDER
      : NEGATIVE_POLARITY_COLOR_ORDER;

  return (
    <StyledHoverCard
      skipWrapper
      body={
        <Stack gap="md">
          <ContextTitle>{title}</ContextTitle>
          <Flex as="span" align="center" gap="xs">
            <StyledIndicator color={theme.colors[colorOrder[0]]} size={10} />
            <span>0 - {maxOneValue}</span>
          </Flex>
          <Flex as="span" align="center" gap="xs">
            <StyledIndicator color={theme.colors[colorOrder[1]]} size={10} />
            <span>
              {maxOneValue} - {maxTwoValue}
            </span>
          </Flex>
          <Flex as="span" align="center" gap="xs">
            <StyledIndicator color={theme.colors[colorOrder[2]]} size={10} />
            <span>
              {maxTwoValue} - {t('No max')}
            </span>
          </Flex>
        </Stack>
      }
    >
      {children}
    </StyledHoverCard>
  );
}

const StyledHoverCard = styled(Hovercard)`
  width: fit-content;
`;

const ContextTitle = styled('h6')`
  color: ${p => p.theme.tokens.content.secondary};
  margin-bottom: 0 !important;
`;

const StyledIndicator = styled(CircleIndicator)`
  margin-right: ${space(1)};
`;
