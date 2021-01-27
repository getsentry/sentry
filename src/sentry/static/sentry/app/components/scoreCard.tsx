import React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import {Theme} from 'app/utils/theme';

type Props = {
  title: React.ReactNode;
  score?: React.ReactNode;
  help?: React.ReactNode;
  trend?: React.ReactNode;
  trendStatus?: 'good' | 'bad';
  className?: string;
};

function ScoreCard({title, score, help, trend, trendStatus, className}: Props) {
  return (
    <StyledPanel className={className}>
      <HeaderTitle>
        <Title>{title}</Title>
        {help && <QuestionTooltip title={help} size="sm" position="top" />}
      </HeaderTitle>

      <ScoreWrapper>
        <Score>{score ?? '\u2014'}</Score>
        {defined(trend) && <Trend trendStatus={trendStatus}>{trend}</Trend>}
      </ScoreWrapper>
    </StyledPanel>
  );
}

function getTrendColor(p: TrendProps & {theme: Theme}) {
  switch (p.trendStatus) {
    case 'good':
      return p.theme.green300;
    case 'bad':
      return p.theme.red300;
    default:
      return p.theme.gray300;
  }
}

const StyledPanel = styled(Panel)`
  padding: ${space(2)} ${space(3)};
  min-height: 100px;
`;

const HeaderTitle = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
`;

const Title = styled('div')`
  ${overflowEllipsis};
`;

const ScoreWrapper = styled('div')`
  display: flex;
  align-items: baseline;
`;

const Score = styled('span')`
  font-size: 32px;
  margin-top: ${space(1)};
`;

type TrendProps = {trendStatus: Props['trendStatus']};

const Trend = styled('span')<TrendProps>`
  color: ${getTrendColor};
  margin-left: ${space(1)};
  ${overflowEllipsis};
`;

export default ScoreCard;
