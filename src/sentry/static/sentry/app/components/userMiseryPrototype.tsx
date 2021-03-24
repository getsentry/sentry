import React from 'react';

import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import CHART_PALETTE from 'app/constants/chartPalette';
import {tct} from 'app/locale';
import {defined} from 'app/utils';

type Props = {
  bars: number;
  barHeight: number;
  userMisery: number;
  miseryLimit: number;
  totalUsers: number | undefined;
  miserableUsers: number | undefined;
};

function UserMiseryPrototype(props: Props) {
  const {bars, barHeight, userMisery, miseryLimit, totalUsers, miserableUsers} = props;
  // User Misery will always be > 0 because of the maximum a posteriori estimate
  // and below 5% will always be an overestimation of the actual proportion
  // of miserable to total unique users. We are going to visualize it as
  // 0 User Misery while still preserving the actual value for sorting purposes.
  const adjustedMisery = userMisery > 0.05 ? userMisery : 0;

  const palette = new Array(bars).fill([CHART_PALETTE[0][0]]);
  const score = Math.round(adjustedMisery * palette.length);

  let title: React.ReactNode;
  if (defined(miserableUsers) && defined(totalUsers)) {
    title = tct(
      '[miserableUsers] out of [totalUsers] unique users waited more than [duration]ms',
      {
        miserableUsers,
        totalUsers,
        duration: 4 * miseryLimit,
      }
    );
  } else {
    title = tct(
      'User Misery score is [userMisery], representing users who waited more than more than [duration]ms.',
      {
        duration: 4 * miseryLimit,
        userMisery: userMisery.toFixed(3),
      }
    );
  }
  return (
    <Tooltip title={title} containerDisplayMode="block">
      <ScoreBar size={barHeight} score={score} palette={palette} radius={0} />
    </Tooltip>
  );
}

export default UserMiseryPrototype;
