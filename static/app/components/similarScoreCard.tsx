import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const scoreComponents = {
  'exception:message:character-shingles': t('Exception Message'),
  'exception:stacktrace:pairs': t('Stack Trace Frames'),
  'exception:stacktrace:application-chunks': t('In-App Frames'),
  'message:message:character-shingles': t('Log Message'),

  // v2
  'similarity:*:type:character-5-shingle': t('Exception Type'),
  'similarity:*:value:character-5-shingle': t('Exception Message'),
  'similarity:*:stacktrace:frames-pairs': t('Stack Trace Frames'),
  'similarity:*:message:character-5-shingle': t('Log Message'),
};

type ScoreValue = number | null;

type Props = {
  // we treat the score list keys as opaque as we wish to be able to extend the
  // backend without having to fix UI. Keys not in scoreComponents are grouped
  // into Other anyway
  scoreList?: Array<[string, ScoreValue]>;
};

function SimilarScoreCard({scoreList = []}: Props) {
  if (scoreList.length === 0) {
    return null;
  }

  let sumOtherScores = 0;
  let numOtherScores = 0;

  return (
    <Fragment>
      {scoreList.map(([key, score]) => {
        const title =
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          scoreComponents[key.replace(/similarity:\d\d\d\d-\d\d-\d\d/, 'similarity:*')];

        if (!title) {
          if (score !== null) {
            sumOtherScores += score;
            numOtherScores += 1;
          }
          return null;
        }

        return (
          <Wrapper key={key}>
            <div>{title}</div>
            <Score score={score === null ? score : Math.round(score * 4)} />
          </Wrapper>
        );
      })}

      {numOtherScores > 0 && sumOtherScores > 0 && (
        <Wrapper>
          <div>{t('Other')}</div>
          <Score score={Math.round((sumOtherScores * 4) / numOtherScores)} />
        </Wrapper>
      )}
    </Fragment>
  );
}

const Wrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  margin: ${space(0.25)} 0;
`;

const Score = styled('div')<{score: ScoreValue}>`
  height: 16px;
  width: 48px;
  border-radius: 2px;
  /* @TODO(jonasbadalic) This used to be defined on the theme, but is component specific and had no dark mode color. */
  background-color: ${p =>
    p.score === null ? '#e2dee6' : SIMILARITY_SCORE_COLORS[p.score]};
`;

// @TODO(jonasbadalic) This used to be defined on the theme, but is component specific and had no dark mode color.
export const SIMILARITY_SCORE_COLORS = [
  '#ec5e44',
  '#f38259',
  '#f9a66d',
  '#98b480',
  '#57be8c',
] as const;

export default SimilarScoreCard;
