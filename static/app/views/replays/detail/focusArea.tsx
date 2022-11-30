// import {useCallback} from 'react';

import {useCallback, useEffect} from 'react';

import LazyLoad from 'sentry/components/lazyLoad';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {};

function FocusArea({}: Props) {
  const {getActiveTab} = useActiveReplayTab();
  const {currentTime, currentHoverTime, replay, setCurrentTime, setCurrentHoverTime} =
    useReplayContext();
  const organization = useOrganization();

  const console = useCallback(() => import('sentry/views/replays/detail/console'), []);
  const dom = useCallback(() => import('sentry/views/replays/detail/domMutations'), []);
  const issues = useCallback(() => import('sentry/views/replays/detail/issueList'), []);
  const memory = useCallback(() => import('sentry/views/replays/detail/memoryChart'), []);
  const network = useCallback(() => import('sentry/views/replays/detail/network'), []);
  const trace = useCallback(() => import('sentry/views/replays/detail/trace/index'), []);

  useEffect(() => {
    if (replay) {
      // Preload the code for these tabs shortly after we have loaded and rendered the data.
      setTimeout(() => {
        console();
        dom();
        issues();
        memory();
        network();
        trace();
      }, 100);
    }
  }, [replay, console, dom, issues, memory, network, trace]);

  switch (getActiveTab()) {
    case 'console':
      return <LazyLoad component={console} replay={replay} />;
    case 'network':
      return <LazyLoad component={network} replay={replay} />;
    case 'trace':
      if (!replay) {
        return <Placeholder height="100%" />;
      }
      return (
        <LazyLoad
          component={trace}
          organization={organization}
          replayRecord={replay?.getReplay()}
        />
      );
    case 'issues':
      if (!replay) {
        return <Placeholder height="100%" />;
      }
      return (
        <LazyLoad
          component={issues}
          replayId={replay?.getReplay().id}
          projectId={replay?.getReplay().projectId}
        />
      );
    case 'dom':
      return <LazyLoad component={dom} replay={replay} />;
    case 'memory':
      if (!replay) {
        return <Placeholder height="100%" />;
      }
      return (
        <LazyLoad
          component={memory}
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
