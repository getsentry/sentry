import React from 'react';

import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import CHART_PALETTE from 'app/constants/chartPalette';
import {tct} from 'app/locale';

type Props = {
  bars: number;
  barHeight: number;
  userMisery: number;
  totalUsers: number;
  miseryLimit: number;
  miserableUsers: number;
};

function Misery(props: Props) {
  const {bars, barHeight, userMisery, miseryLimit, totalUsers, miserableUsers} = props;
  // User Misery will always be > 0 because of the maximum a posteriori estimate
  // and below 5% will always be an overestimation of the actual proportion
  // of miserable to total unique users. We are going to visualize it as
  // 0 User Misery while still preserving the actual value for sorting purposes.
  const adjustedMisery = userMisery >= 0.05 ? userMisery : 0;

  const palette = new Array(bars).fill([CHART_PALETTE[0][0]]);
  const score = adjustedMisery ? Math.ceil(adjustedMisery * palette.length) : 0;

  const title = tct(
    '[affectedUsers] out of [totalUsers] unique users waited more than [duration]ms',
    {
      affectedUsers: miserableUsers,
      totalUsers,
      duration: 4 * miseryLimit,
    }
  );
  return (
    <Tooltip title={title} containerDisplayMode="block">
      <ScoreBar size={barHeight} score={score} palette={palette} radius={0} />
    </Tooltip>
  );
}

export default Misery;
