import styled from '@emotion/styled';

import ScoreBar from 'sentry/components/scoreBar';
import Tooltip from 'sentry/components/tooltip';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import {IconSound} from 'sentry/icons';
import {tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import ahh from './ahh(1).wav';
// @ts-ignore
import boop from './boop.wav';
import intenseMisery from './intense-misery.wav';
import misery from './misery.wav';

// Maps User Misery scores to a unique scream audio file
const SCORE_TO_SCREAM_MAP: Record<number, string> = {
  0: ahh,
  1: ahh,
  2: ahh,
  3: ahh,
  4: misery,
  5: misery,
  6: misery,
  7: intenseMisery,
  8: intenseMisery,
  9: intenseMisery,
  10: intenseMisery,
};

type Props = {
  barHeight: number;
  bars: number;
  miserableUsers: number | undefined;
  miseryLimit: number | undefined;
  totalUsers: number | undefined;
  userMisery: number;
};

function UserMisery(props: Props) {
  const {bars, barHeight, userMisery, miseryLimit, totalUsers, miserableUsers} = props;
  // User Misery will always be > 0 because of the maximum a posteriori estimate
  // and below 5% will always be an overestimation of the actual proportion
  // of miserable to total unique users. We are going to visualize it as
  // 0 User Misery while still preserving the actual value for sorting purposes.
  const adjustedMisery = userMisery > 0.05 ? userMisery : 0;

  const palette = new Array(bars).fill([CHART_PALETTE[0][0]]);
  const score = Math.round(adjustedMisery * palette.length);

  const handleSoundButtonClick = () => {
    const adjustedScore = bars > 10 ? Math.round(score / 4) : score;
    const audio = new Audio(SCORE_TO_SCREAM_MAP[adjustedScore]);
    audio.play();
  };

  let title: React.ReactNode;
  if (defined(miserableUsers) && defined(totalUsers) && defined(miseryLimit)) {
    title = tct(
      '[miserableUsers] out of [totalUsers] unique users waited more than [duration]ms (4x the response time threshold)',
      {
        miserableUsers,
        totalUsers,
        duration: 4 * miseryLimit,
      }
    );
  } else if (defined(miseryLimit)) {
    title = tct(
      'User Misery score is [userMisery], representing users who waited more than [duration]ms (4x the response time threshold)',
      {
        duration: 4 * miseryLimit,
        userMisery: userMisery.toFixed(3),
      }
    );
  } else if (defined(miserableUsers) && defined(totalUsers)) {
    title = tct(
      'User Misery score is [userMisery], because [miserableUsers] out of [totalUsers] unique users had a miserable experience.',
      {
        miserableUsers,
        totalUsers,
        userMisery: userMisery.toFixed(3),
      }
    );
  } else {
    title = tct('User Misery score is [userMisery].', {
      userMisery: userMisery.toFixed(3),
    });
  }
  return (
    <Tooltip title={title} containerDisplayMode="block">
      <MiseryWrapper>
        <ScoreBar size={barHeight} score={score} palette={palette} radius={0} />
        <IconButton onClick={handleSoundButtonClick}>
          <IconSound color="gray500" size="sm" />
        </IconButton>
      </MiseryWrapper>
    </Tooltip>
  );
}

const MiseryWrapper = styled('div')`
  display: flex;
`;

const IconButton = styled('div')`
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-left: ${space(1)};
`;

export default UserMisery;
