import ScoreBar from 'sentry/components/scoreBar';
import {Tooltip} from 'sentry/components/tooltip';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {tct} from 'sentry/locale';
import {defined} from 'sentry/utils';

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
      'User Misery score is [userMisery], meaning [miserableUsers] out of [totalUsers] unique users had a miserable experience.',
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
      <ScoreBar
        size={barHeight}
        score={score}
        palette={palette}
        radius={0}
        data-test-id={`score-bar-${score}`}
      />
    </Tooltip>
  );
}

export default UserMisery;
