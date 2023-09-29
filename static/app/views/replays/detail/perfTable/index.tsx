import {useReplayContext} from 'sentry/components/replays/replayContext';
import PerfTable from 'sentry/views/replays/detail/perfTable/perfTable';
import useReplayPerfData from 'sentry/views/replays/detail/perfTable/useReplayPerfData';

type Props = {};

function Perf({}: Props) {
  const {replay} = useReplayContext();
  const perfData = useReplayPerfData({replay});

  return <PerfTable perfData={perfData} />;
}

export default Perf;
