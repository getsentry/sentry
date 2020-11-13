import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';

const scoreComponents = {
  'exception:message:character-shingles': t('Exception Message'),
  'exception:stacktrace:pairs': t('Stacktrace Frames'),
  'message:message:character-shingles': t('Log Message'),
};

type Key = keyof typeof scoreComponents;
type Score = number | null;

type Props = {
  scoreList?: [Key, Score][];
};

const SimilarScoreCard = ({scoreList = []}: Props) => {
  if (scoreList.length === 0) {
    return null;
  }

  return (
    <React.Fragment>
      {scoreList.map(([key, score]) => (
        <Wrapper key={key}>
          <div>{scoreComponents[key]}</div>

          <Score score={score === null ? score : Math.round(score * 5)} />
        </Wrapper>
      ))}
    </React.Fragment>
  );
};

const Wrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  margin: ${space(0.25)} 0;
`;

const Score = styled('div')<{score: Score}>`
  height: 16px;
  width: 48px;
  border-radius: 2px;
  background-color: ${p =>
    p.score === null ? p.theme.similarity.empty : p.theme.similarity.colors[p.score]};
`;

export default SimilarScoreCard;
