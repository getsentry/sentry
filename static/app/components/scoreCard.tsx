import * as React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
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
        {defined(trend) && (
          <Trend trendStatus={trendStatus}>
            <TextOverflow>{trend}</TextOverflow>
          </Trend>
        )}
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
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: ${space(2)} ${space(3)};
  min-height: 96px;
`;

const HeaderTitle = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
  width: fit-content;
`;

const Title = styled('div')`
  ${overflowEllipsis};
`;

const ScoreWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  max-width: 100%;
`;

const Score = styled('span')`
  flex-shrink: 1;
  font-size: 32px;
  line-height: 1;
  white-space: nowrap;
`;

type TrendProps = {trendStatus: Props['trendStatus']};

const Trend = styled('div')<TrendProps>`
  color: ${getTrendColor};
  margin-left: ${space(1)};
  line-height: 1;
  overflow: hidden;
`;

export {HeaderTitle, StyledPanel, Score, ScoreWrapper, Trend};
export default ScoreCard;
