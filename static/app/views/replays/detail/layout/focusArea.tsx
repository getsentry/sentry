import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useActiveReplayTab, {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';
import Console from 'sentry/views/replays/detail/console';
import DomMutations from 'sentry/views/replays/detail/domMutations';
import ErrorList from 'sentry/views/replays/detail/errorList/index';
import IssueList from 'sentry/views/replays/detail/issueList';
import MemoryChart from 'sentry/views/replays/detail/memoryChart';
import NetworkList from 'sentry/views/replays/detail/network';
import Trace from 'sentry/views/replays/detail/trace/index';

type Props = {};

function FocusArea({}: Props) {
  const {getActiveTab} = useActiveReplayTab();
  const {currentTime, currentHoverTime, replay, setCurrentTime, setCurrentHoverTime} =
    useReplayContext();
  const organization = useOrganization();

  switch (getActiveTab()) {
    case TabKey.NETWORK:
      return (
        <NetworkList
          isNetworkDetailsSetup={Boolean(replay?.isNetworkDetailsSetup())}
          networkSpans={replay?.getNetworkSpans()}
          projectId={replay?.getReplay()?.project_id}
          startTimestampMs={replay?.getReplay()?.started_at?.getTime() || 0}
        />
      );
    case TabKey.TRACE:
      return <Trace organization={organization} replayRecord={replay?.getReplay()} />;
    case TabKey.ISSUES:
      if (!replay) {
        return <Placeholder height="150px" />;
      }
      return (
        <IssueList
          replayId={replay.getReplay()?.id}
          projectId={replay.getReplay()?.project_id}
        />
      );
    case TabKey.ERRORS:
      return (
        <ErrorList
          errorFrames={replay?.getErrorFrames()}
          startTimestampMs={replay?.getReplay().started_at.getTime() ?? 0}
        />
      );
    case TabKey.DOM:
      return (
        <DomMutations
          replay={replay}
          startTimestampMs={replay?.getReplay()?.started_at?.getTime() || 0}
        />
      );
    case TabKey.MEMORY:
      return (
        <MemoryChart
          currentTime={currentTime}
          currentHoverTime={currentHoverTime}
          memoryFrames={replay?.getMemoryFrames()}
          setCurrentTime={setCurrentTime}
          setCurrentHoverTime={setCurrentHoverTime}
          startTimestampMs={replay?.getReplay()?.started_at?.getTime()}
        />
      );
    case TabKey.CONSOLE:
    default: {
      const hasErrorTab = organization.features.includes('session-replay-errors-tab');

      if (hasErrorTab) {
        return (
          <Console
            breadcrumbs={replay?.getConsoleCrumbs()}
            startTimestampMs={replay?.getReplay().started_at.getTime() || 0}
          />
        );
      }

      const breadcrumbs = replay
        ? [...replay.getConsoleCrumbs(), ...replay.getIssueCrumbs()]
        : undefined;
      return (
        <Console
          breadcrumbs={breadcrumbs}
          startTimestampMs={replay?.getReplay().started_at.getTime() || 0}
        />
      );
    }
  }
}

export default FocusArea;
