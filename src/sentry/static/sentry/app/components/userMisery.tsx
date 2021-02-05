import React from 'react';

import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import CHART_PALETTE from 'app/constants/chartPalette';
import {tct} from 'app/locale';

type Props = {
  bars: number;
  barHeight: number;
  miserableUsers: number;
  totalUsers: number;
  miseryLimit: number;
};

function UserMisery(props: Props) {
  const {bars, barHeight, miserableUsers, miseryLimit, totalUsers} = props;

  const palette = new Array(bars).fill([CHART_PALETTE[0][0]]);
  const rawScore = Math.floor(
    (miserableUsers / Math.max(totalUsers, 1)) * palette.length
  );

  const adjustedScore = rawScore > 0 ? rawScore : miserableUsers > 0 ? 1 : 0;

  const miseryPercentage = ((100 * miserableUsers) / Math.max(totalUsers, 1)).toFixed(2);

  const title = tct(
    '[affectedUsers] out of [totalUsers] ([miseryPercentage]%) unique users waited more than [duration]ms',
    {
      affectedUsers: miserableUsers,
      totalUsers,
      miseryPercentage,
      duration: 4 * miseryLimit,
    }
  );
  return (
    <Tooltip title={title} containerDisplayMode="block">
      <ScoreBar size={barHeight} score={adjustedScore} palette={palette} radius={0} />
    </Tooltip>
  );
}

export default UserMisery;
