import PropTypes from 'prop-types';

import {tct} from 'app/locale';
import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import theme from 'app/utils/theme';

type Props = {
  bars: number;
  barHeight: number;
  miserableUsers: number;
  totalUsers: number;
  miseryLimit: number;
};

function UserMisery(props: Props) {
  const {bars, barHeight, miserableUsers, miseryLimit, totalUsers} = props;

  const palette = new Array(bars).fill(theme.purple500);
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

UserMisery.propTypes = {
  bars: PropTypes.number,
  miserableUsers: PropTypes.number,
  totalUsers: PropTypes.number,
  miseryLimit: PropTypes.number,
};

export default UserMisery;
