import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {formatPercentage} from 'sentry/utils/formatters';
import {getTooltip} from 'sentry/views/starfish/views/spans/types';

export function TimeSpentCell({
  timeSpentPercentage,
  totalSpanTime,
}: {
  timeSpentPercentage: number;
  totalSpanTime: number;
}) {
  const toolTip = getTooltip('timeSpent', totalSpanTime);
  const percentage = timeSpentPercentage > 1 ? 1 : timeSpentPercentage;
  return (
    <Container>
      <Tooltip isHoverable title={toolTip}>
        {formatPercentage(percentage)}
      </Tooltip>
    </Container>
  );
}

const Container = styled('div')`
  width: 100%;
  text-align: right;
`;
