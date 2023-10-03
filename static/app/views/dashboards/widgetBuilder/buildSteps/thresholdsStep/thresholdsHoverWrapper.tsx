import React from 'react';
import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import {Hovercard} from 'sentry/components/hovercard';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

import {ThresholdsConfig} from './thresholdsStep';

type Props = {
  children: React.ReactNode;
  thresholds: ThresholdsConfig;
};

function ThresholdsHoverWrapper({children, thresholds}: Props) {
  const {
    unit,
    max_values: {max1, max2},
  } = thresholds;
  const notSetMsg = t('Not set');
  const maxOneValue = max1 ?? notSetMsg;
  const maxTwoValue = max2 ?? notSetMsg;
  const title = unit ? t(`Thresholds in %ss`, unit) : t('Thresholds');

  return (
    <StyledHoverCard
      skipWrapper
      body={
        <BodyWrapper>
          <ContextTitle>{title}</ContextTitle>
          <Row>
            <StyledIndicator color={theme.green300} size={10} />
            <span>0 - {maxOneValue}</span>
          </Row>
          <Row>
            <StyledIndicator color={theme.yellow300} size={10} />
            <span>
              {maxOneValue} - {maxTwoValue}
            </span>
          </Row>
          <Row>
            <StyledIndicator color={theme.red300} size={10} />
            <span>
              {maxTwoValue} - {t('No max')}
            </span>
          </Row>
        </BodyWrapper>
      }
    >
      {children}
    </StyledHoverCard>
  );
}

const StyledHoverCard = styled(Hovercard)`
  width: fit-content;
`;

const BodyWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const Row = styled('span')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

const ContextTitle = styled('h6')`
  color: ${p => p.theme.subText};
  margin-bottom: 0 !important;
`;

const StyledIndicator = styled(CircleIndicator)`
  margin-right: ${space(1)};
`;

export default ThresholdsHoverWrapper;
