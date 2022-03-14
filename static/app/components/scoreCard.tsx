import * as React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {Theme} from 'sentry/utils/theme';

type Props = {
  title: React.ReactNode;
  className?: string;
  help?: React.ReactNode;
  score?: React.ReactNode;
  trend?: React.ReactNode;
  trendStatus?: 'good' | 'bad';
};

function ScoreCard({title, score, help, trend, trendStatus, className}: Props) {
  return (
    <ScorePanel className={className}>
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
    </ScorePanel>
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

export const ScorePanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: ${space(2)} ${space(3)};
  min-height: 96px;
`;

export const HeaderTitle = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  width: fit-content;
`;

const Title = styled('div')`
  color: ${p => p.theme.headingColor};
  ${overflowEllipsis};
  font-weight: 600;
`;

export const ScoreWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  max-width: 100%;
`;

export const Score = styled('span')`
  flex-shrink: 1;
  font-size: 32px;
  line-height: 1;
  color: ${p => p.theme.headingColor};
  white-space: nowrap;
`;

type TrendProps = {trendStatus: Props['trendStatus']};

export const Trend = styled('div')<TrendProps>`
  color: ${getTrendColor};
  margin-left: ${space(1)};
  line-height: 1;
  overflow: hidden;
`;

export default ScoreCard;
