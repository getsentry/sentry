import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';
import Console from 'sentry/views/replays/detail/console';
import DomMutations from 'sentry/views/replays/detail/domMutations';
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
    case 'console':
      return (
        <Console
          breadcrumbs={replay?.getConsoleCrumbs()}
          startTimestampMs={replay?.getReplay()?.startedAt?.getTime() || 0}
        />
      );
    case 'network':
      return (
        <NetworkList
          networkSpans={replay?.getNetworkSpans()}
          startTimestampMs={replay?.getReplay()?.startedAt?.getTime() || 0}
        />
      );
    case 'trace':
      if (!replay) {
        return <Placeholder height="150px" />;
      }
      return <Trace organization={organization} replayRecord={replay.getReplay()} />;
    case 'issues':
      if (!replay) {
        return <Placeholder height="150px" />;
      }
      return (
        <IssueList
          replayId={replay.getReplay()?.id}
          projectId={replay.getReplay()?.projectId}
        />
      );
    case 'dom':
      return (
        <DomMutations
          replay={replay}
          startTimestampMs={replay?.getReplay()?.startedAt?.getTime() || 0}
        />
      );
    case 'memory':
      return (
        <MemoryChart
          currentTime={currentTime}
          currentHoverTime={currentHoverTime}
          memorySpans={replay?.getMemorySpans()}
          setCurrentTime={setCurrentTime}
          setCurrentHoverTime={setCurrentHoverTime}
          startTimestampMs={replay?.getReplay()?.startedAt?.getTime()}
        />
      );
    default:
      return null;
  }
}

export default FocusArea;
