import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type Props = {
  title: React.ReactNode;
  score?: React.ReactNode;
  help?: React.ReactNode;
  trend?: React.ReactNode;
  trendStyle?: 'good' | 'bad';
  className?: string;
};

function ScoreCard({title, score, help, trend, trendStyle, className}: Props) {
  return (
    <StyledPanel className={className}>
      <PanelBody withPadding>
        <TitleWrapper>
          <Title>{title}</Title>

          {help && <StyledQuestionTooltip title={help} size="sm" position="top" />}
        </TitleWrapper>

        <ScoreWrapper>
          <Score>{score ?? '\u2014'}</Score>

          {trend && <Trend trendStyle={trendStyle}>{trend}</Trend>}
        </ScoreWrapper>
      </PanelBody>
    </StyledPanel>
  );
}

function getTrendColor(p: TrendProps & {theme: Theme}) {
  switch (p.trendStyle) {
    case 'good':
      return p.theme.green300;
    case 'bad':
      return p.theme.red300;
    default:
      return p.theme.blue300;
  }
}

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(2)};
`;

const Title = styled('h3')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 400;
  margin-bottom: 0 !important;
  ${overflowEllipsis};
  width: auto;
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(1)};
`;

const ScoreWrapper = styled('div')`
  display: flex;
  align-items: baseline;
`;

const Score = styled('span')`
  font-size: 36px;
`;

type TrendProps = {trendStyle: Props['trendStyle']};

const Trend = styled('span')<TrendProps>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${getTrendColor};
  margin-left: ${space(1)};
  ${overflowEllipsis};
`;

export default ScoreCard;
